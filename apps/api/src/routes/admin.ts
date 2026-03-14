import { Router } from 'express';
import type { Server } from 'socket.io';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { emitTenantEvent } from '../lib/events.js';
import {
  createApartmentCode,
  createBuildingCode,
  createUnitCode,
  createUnitLabel,
  formatUnitSummary,
  slugify
} from '../lib/building-layout.js';
import {
  createGeneratedPhones,
  createTemporaryPassword,
  normalizePhoneInput,
  toLoginPhone
} from '../lib/auth-credentials.js';
import { listProvincesWithDistricts } from '../lib/location-seed.js';
import { prisma } from '../lib/prisma.js';
import { sendOpenDoorCommand } from '../services/door-control.js';

const buildingSummaryInclude = {
  district: {
    include: {
      province: true
    }
  },
  _count: {
    select: {
      blocks: true,
      apartments: true,
      units: true
    }
  }
} satisfies Prisma.BuildingInclude;

const buildingDetailInclude = {
  district: {
    include: {
      province: true
    }
  },
  blocks: {
    orderBy: {
      sequence: 'asc'
    },
    include: {
      apartments: {
        orderBy: {
          sequence: 'asc'
        },
        include: {
          units: {
            orderBy: [{ floorNumber: 'asc' }, { number: 'asc' }],
            include: {
              residents: {
                where: {
                  role: 'RESIDENT'
                },
                orderBy: {
                  createdAt: 'asc'
                }
              }
            }
          }
        }
      }
    }
  },
  _count: {
    select: {
      blocks: true,
      apartments: true,
      units: true
    }
  }
} satisfies Prisma.BuildingInclude;

const guestLogInclude = {
  resident: {
    include: {
      unit: {
        include: {
          block: true,
          apartment: true
        }
      }
    }
  }
} satisfies Prisma.GuestLogInclude;

const adminUserInclude = {
  building: {
    include: {
      district: {
        include: {
          province: true
        }
      }
    }
  },
  unit: {
    include: {
      block: true,
      apartment: true
    }
  },
  assignedBuildings: {
    include: {
      district: {
        include: {
          province: true
        }
      }
    }
  }
} satisfies Prisma.UserInclude;

type BuildingSummaryRecord = Prisma.BuildingGetPayload<{ include: typeof buildingSummaryInclude }>;
type BuildingDetailRecord = Prisma.BuildingGetPayload<{ include: typeof buildingDetailInclude }>;
type GuestLogRecord = Prisma.GuestLogGetPayload<{ include: typeof guestLogInclude }>;
type UserWithAssignments = Prisma.UserGetPayload<{ include: { assignedBuildings: true } }>;
type AdminUserRecord = Prisma.UserGetPayload<{ include: typeof adminUserInclude }>;

const apartmentDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(40)
});

const blockSchema = z.object({
  name: z.string().trim().min(1).max(40),
  apartments: z.array(apartmentDefinitionSchema).min(1).max(99)
});

const floorPlanSchema = z.object({
  floorNumber: z.coerce.number().int().min(1).max(99),
  unitCount: z.coerce.number().int().min(1).max(999)
});

const unitSchema = z.object({
  blockSequence: z.coerce.number().int().min(1).max(99),
  apartmentSequence: z.coerce.number().int().min(1).max(99),
  floorNumber: z.coerce.number().int().min(1).max(99),
  unitNumber: z.coerce.number().int().min(1).max(999),
  ownerName: z.string().trim().max(120).optional(),
  isVacant: z.boolean().default(false)
});

const createBuildingSchema = z
  .object({
    provinceId: z.string().min(1),
    districtId: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    floorCount: z.coerce.number().int().min(1).max(99),
    blocks: z.array(blockSchema).min(1).max(99),
    floorPlans: z.array(floorPlanSchema).min(1).max(99),
    units: z.array(unitSchema).min(1)
  })
  .superRefine((input, ctx) => {
    if (input.floorPlans.length !== input.floorCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Her kat için ayrı daire planı girilmelidir.',
        path: ['floorPlans']
      });
    }

    const blockNames = new Set<string>();
    input.blocks.forEach((block, blockIndex) => {
      const normalizedBlockName = block.name.toLocaleLowerCase('tr-TR');
      if (blockNames.has(normalizedBlockName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Blok adları benzersiz olmalıdır.',
          path: ['blocks', blockIndex, 'name']
        });
      }
      blockNames.add(normalizedBlockName);

      const apartmentNames = new Set<string>();
      block.apartments.forEach((apartment, apartmentIndex) => {
        const normalizedApartmentName = apartment.name.toLocaleLowerCase('tr-TR');
        if (apartmentNames.has(normalizedApartmentName)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Aynı blok içindeki apartman adları benzersiz olmalıdır.',
            path: ['blocks', blockIndex, 'apartments', apartmentIndex, 'name']
          });
        }
        apartmentNames.add(normalizedApartmentName);
      });
    });

    const expectedFloors = new Set(Array.from({ length: input.floorCount }, (_, index) => index + 1));
    const seenFloors = new Set<number>();

    input.floorPlans.forEach((plan, index) => {
      if (!expectedFloors.has(plan.floorNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kat numaraları 1 ile kat sayısı arasında olmalıdır.',
          path: ['floorPlans', index, 'floorNumber']
        });
      }

      if (seenFloors.has(plan.floorNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Aynı kat yalnızca bir kez tanımlanabilir.',
          path: ['floorPlans', index, 'floorNumber']
        });
      }

      seenFloors.add(plan.floorNumber);
    });

    const floorPlanByFloor = new Map(input.floorPlans.map((plan) => [plan.floorNumber, plan.unitCount]));
    const apartmentTotal = input.blocks.reduce((total, block) => total + block.apartments.length, 0);
    const expectedUnitTotal = apartmentTotal * input.floorPlans.reduce((total, plan) => total + plan.unitCount, 0);

    if (input.units.length !== expectedUnitTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Daire listesi blok, apartman ve kat planıyla uyumlu değil.',
        path: ['units']
      });
    }

    const unitKeys = new Set<string>();
    const unitBuckets = new Map<string, number[]>();

    input.units.forEach((unit, index) => {
      const block = input.blocks[unit.blockSequence - 1];

      if (!block) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Geçersiz blok sırası.',
          path: ['units', index, 'blockSequence']
        });
        return;
      }

      if (!block.apartments[unit.apartmentSequence - 1]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Geçersiz apartman sırası.',
          path: ['units', index, 'apartmentSequence']
        });
      }

      if (!floorPlanByFloor.has(unit.floorNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Geçersiz kat numarası.',
          path: ['units', index, 'floorNumber']
        });
      }

      const compositeKey = `${unit.blockSequence}:${unit.apartmentSequence}:${unit.floorNumber}:${unit.unitNumber}`;
      if (unitKeys.has(compositeKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Aynı blok, apartman, kat ve daire numarası birden fazla kez gönderildi.',
          path: ['units', index]
        });
      }
      unitKeys.add(compositeKey);

      const ownerName = unit.ownerName?.trim() ?? '';
      if (unit.isVacant && ownerName.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Boş işaretlenen daireye malik adı yazılamaz.',
          path: ['units', index, 'ownerName']
        });
      }

      if (!unit.isVacant && ownerName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Dolu dairelerde malik adı zorunludur.',
          path: ['units', index, 'ownerName']
        });
      }

      const bucketKey = `${unit.blockSequence}:${unit.apartmentSequence}:${unit.floorNumber}`;
      const unitNumbers = unitBuckets.get(bucketKey) ?? [];
      unitNumbers.push(unit.unitNumber);
      unitBuckets.set(bucketKey, unitNumbers);
    });

    input.blocks.forEach((block, blockIndex) => {
      block.apartments.forEach((_apartment, apartmentIndex) => {
        input.floorPlans.forEach((plan) => {
          const bucketKey = `${blockIndex + 1}:${apartmentIndex + 1}:${plan.floorNumber}`;
          const unitNumbers = (unitBuckets.get(bucketKey) ?? []).sort((left, right) => left - right);

          if (unitNumbers.length !== plan.unitCount) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${block.name} blok, ${block.apartments[apartmentIndex]?.name ?? 'Apartman'} için ${plan.floorNumber}. katta ${plan.unitCount} daire bekleniyor.`,
              path: ['units']
            });
            return;
          }

          unitNumbers.forEach((value, numberIndex) => {
            if (value !== numberIndex + 1) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Daire numaraları 1’den başlayıp kesintisiz ilerlemelidir.',
                path: ['units']
              });
            }
          });
        });
      });
    });
  });

const createUserSchema = z.object({
  name: z.string().trim().min(3).max(120),
  phone: z.string().trim().regex(/^5\d{9}$/, 'Telefon numarasını 5xxxxxxxxx biçiminde girin.'),
  role: z.enum(['SUPER_ADMIN', 'CONCIERGE']),
  buildingIds: z.array(z.string()).max(20).optional().default([])
});

const updateAdminUserSchema = z.object({
  name: z.string().trim().min(3).max(120),
  phone: z.string().trim().regex(/^5\d{9}$/, 'Telefon numarasını 5xxxxxxxxx biçiminde girin.'),
  buildingIds: z.array(z.string()).max(20).optional().default([])
});

const updateBuildingSchema = z.object({
  name: z.string().trim().min(2).max(120)
});

const updateBlockSchema = z.object({
  name: z.string().trim().min(1).max(40)
});

const updateApartmentSchema = z.object({
  name: z.string().trim().min(1).max(40)
});

const updateUnitResidentSchema = z.object({
  ownerName: z.string().trim().min(2).max(120),
  phone: z
    .union([z.string().trim().regex(/^5\d{9}$/, 'Telefon numarasını 5xxxxxxxxx biçiminde girin.'), z.literal('')])
    .optional()
});

function getDbUser(req: any): UserWithAssignments | null {
  return (req as { currentUser?: UserWithAssignments }).currentUser ?? null;
}

function hasSuperAdminAccess(req: any) {
  return req.user?.role === 'SUPER_ADMIN' || getDbUser(req)?.role === 'SUPER_ADMIN';
}

function hasAdminAccess(req: any) {
  return hasSuperAdminAccess(req) || req.user?.role === 'CONCIERGE' || getDbUser(req)?.role === 'CONCIERGE';
}

function impossibleIds() {
  return ['__no_access__'];
}

function toClientRole(role: AdminUserRecord['role']) {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'super_admin' as const;
    case 'BUILDING_ADMIN':
      return 'building_admin' as const;
    case 'CONCIERGE':
      return 'concierge' as const;
    case 'RESIDENT':
      return 'resident' as const;
  }
}

function formatUnitNumber(
  unit:
    | {
        block: { name: string };
        apartment: { name: string } | null;
        floorNumber: number;
        number: number;
      }
    | null
    | undefined
) {
  if (!unit) {
    return 'Bilinmiyor';
  }

  return formatUnitSummary(
    unit.block.name,
    unit.apartment?.name ?? 'Apartman',
    unit.floorNumber,
    unit.number
  );
}

function mapBuildingSummary(building: BuildingSummaryRecord) {
  return {
    id: building.id,
    districtId: building.districtId,
    code: building.code,
    siteNumber: building.siteNumber,
    name: building.name,
    slug: building.slug,
    status: building.status,
    blockCount: building._count.blocks,
    apartmentCount: building._count.apartments,
    unitCount: building._count.units,
    district: {
      id: building.district.id,
      code: building.district.code,
      name: building.district.name,
      province: {
        id: building.district.province.id,
        code: building.district.province.code,
        name: building.district.province.name
      }
    }
  };
}

function mapBuildingDetail(building: BuildingDetailRecord) {
  const apartments = building.blocks.flatMap((block) => block.apartments);
  const units = apartments.flatMap((apartment) => apartment.units);
  const occupiedUnits = units.filter((unit) => !unit.isVacant).length;

  return {
    ...mapBuildingSummary(building),
    vacantUnitCount: units.length - occupiedUnits,
    occupiedUnitCount: occupiedUnits,
    blocks: building.blocks.map((block) => {
      const blockUnits = block.apartments.flatMap((apartment) => apartment.units);

      return {
        id: block.id,
        name: block.name,
        sequence: block.sequence,
        floorCount: block.floorCount,
        apartmentCount: block.apartments.length,
        unitCount: blockUnits.length,
        occupiedUnitCount: blockUnits.filter((unit) => !unit.isVacant).length,
        apartments: block.apartments.map((apartment) => ({
          id: apartment.id,
          name: apartment.name,
          sequence: apartment.sequence,
          code: apartment.code,
          floorCount: apartment.floorCount,
          unitCount: apartment.units.length,
          occupiedUnitCount: apartment.units.filter((unit) => !unit.isVacant).length,
          tablet: {
            id: apartment.id,
            loginId: apartment.code,
            temporaryPassword: apartment.passwordChangedAt ? undefined : apartment.temporaryPassword ?? undefined,
            passwordChanged: Boolean(apartment.passwordChangedAt),
            lastLoginAt: apartment.lastLoginAt?.toISOString() ?? undefined
          },
          units: apartment.units.map((unit) => mapBuildingUnit(block.name, apartment.name, unit))
        }))
      };
    })
  };
}

function mapBuildingUnit(
  blockName: string,
  apartmentName: string,
  unit: {
    id: string;
    code: string;
    label: string | null;
    floorNumber: number;
    number: number;
    ownerName: string | null;
    isVacant: boolean;
    residents: Array<{
      id: string;
      fullName: string;
      phone: string;
      temporaryPassword: string | null;
      passwordChangedAt: Date | null;
      lastLoginAt: Date | null;
    }>;
  }
) {
  const resident = unit.residents[0] ?? null;

  return {
    id: unit.id,
    code: unit.code,
    label: unit.label ?? createUnitLabel(blockName, apartmentName, unit.floorNumber, unit.number),
    floorNumber: unit.floorNumber,
    unitNumber: unit.number,
    ownerName: unit.ownerName,
    isVacant: unit.isVacant,
    resident: resident
      ? {
          id: resident.id,
          fullName: resident.fullName,
          loginPhone: toLoginPhone(resident.phone),
          temporaryPassword: resident.passwordChangedAt ? undefined : resident.temporaryPassword ?? undefined,
          passwordChanged: Boolean(resident.passwordChangedAt),
          lastLoginAt: resident.lastLoginAt?.toISOString() ?? undefined
        }
      : null
  };
}

function mapGuestLog(log: GuestLogRecord) {
  return {
    id: log.id,
    buildingId: log.buildingId,
    residentId: log.residentId ?? '',
    residentName: log.resident?.fullName ?? log.resident?.unit?.ownerName ?? 'Atanmamış',
    unitNumber: formatUnitNumber(log.resident?.unit ?? null),
    visitorLabel: log.visitorName,
    visitorType: log.visitorType.toLocaleLowerCase('en-US'),
    status: log.status.toLocaleLowerCase('en-US'),
    createdAt: log.createdAt.toISOString(),
    decidedAt: log.decidedAt?.toISOString(),
    imageUrl: log.imageUrl ?? undefined
  };
}

function mapAdminUser(user: AdminUserRecord) {
  return {
    id: user.id,
    fullName: user.fullName,
    role: toClientRole(user.role),
    phone: user.phone,
    loginPhone: toLoginPhone(user.phone),
    isActive: user.isActive,
    passwordChanged: Boolean(user.passwordChangedAt),
    temporaryPassword: user.passwordChangedAt ? undefined : user.temporaryPassword ?? undefined,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? undefined,
    building:
      user.building
        ? {
            id: user.building.id,
            name: user.building.name
          }
        : undefined,
    unit:
      user.unit
        ? {
            id: user.unit.id,
            code: user.unit.code,
            label: createUnitLabel(
              user.unit.block.name,
              user.unit.apartment?.name ?? 'Apartman',
              user.unit.floorNumber,
              user.unit.number
            )
          }
        : undefined,
    assignedBuildings: user.assignedBuildings.map((building) => ({
      id: building.id,
      name: building.name,
      district: building.district.name,
      province: building.district.province.name
    }))
  };
}

async function resolveAccessibleBuildingIds(req: any) {
  const currentUser = getDbUser(req);

  if (hasSuperAdminAccess(req)) {
    const buildings = await prisma.building.findMany({
      select: { id: true }
    });
    return buildings.map((building) => building.id);
  }

  if (currentUser?.assignedBuildings.length) {
    return currentUser.assignedBuildings.map((building) => building.id);
  }

  if (currentUser?.buildingId) {
    return [currentUser.buildingId];
  }

  if (typeof req.user?.buildingId === 'string' && req.user.buildingId.length > 0) {
    return [req.user.buildingId];
  }

  return [];
}

async function ensureBuildingAccess(req: any, buildingId: string) {
  if (hasSuperAdminAccess(req)) {
    return true;
  }

  const accessibleIds = await resolveAccessibleBuildingIds(req);
  return accessibleIds.includes(buildingId);
}

export function createAdminRouter(io: Server) {
  const router = Router();

  router.use(async (req, _res, next) => {
    const tokenUserId = req.user?.sub !== 'api-key-user' ? req.user?.sub : undefined;
    const queryPhone = typeof req.query.phone === 'string' ? req.query.phone : undefined;

    if (!tokenUserId && !queryPhone) {
      next();
      return;
    }

    const dbUser = await prisma.user.findFirst({
      where: tokenUserId ? { id: tokenUserId } : { phone: queryPhone },
      include: { assignedBuildings: true }
    });

    if (dbUser) {
      (req as { currentUser?: UserWithAssignments }).currentUser = dbUser;
    }

    next();
  });

  router.get('/overview', async (req, res) => {
    if (!hasAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const buildingIds = await resolveAccessibleBuildingIds(req);
    const scopedBuildingIds = buildingIds.length > 0 ? buildingIds : impossibleIds();

    const [buildings, latestLogs, fallbackLogs] = await Promise.all([
      prisma.building.findMany({
        where: { id: { in: scopedBuildingIds } },
        include: buildingSummaryInclude,
        orderBy: [{ status: 'desc' }, { createdAt: 'desc' }]
      }),
      prisma.guestLog.findMany({
        where: { buildingId: { in: scopedBuildingIds } },
        include: guestLogInclude,
        orderBy: { createdAt: 'desc' },
        take: 12
      }),
      prisma.guestLog.findMany({
        where: {
          buildingId: { in: scopedBuildingIds },
          status: { in: ['ESCALATED', 'REJECTED'] }
        },
        include: guestLogInclude,
        orderBy: { createdAt: 'desc' },
        take: 12
      })
    ]);

    const resolvedCalls = latestLogs.filter((log) => log.status !== 'WAITING');
    res.json({
      metrics: {
        totalBuildings: buildings.length,
        onlineBuildings: buildings.filter((building) => building.status === 'ONLINE').length,
        waitingCalls: latestLogs.filter((log) => log.status === 'WAITING').length,
        droppedCalls: fallbackLogs.length,
        approvalRate:
          resolvedCalls.length === 0
            ? 0
            : Math.round((resolvedCalls.filter((log) => log.status === 'APPROVED').length / resolvedCalls.length) * 1000) /
              10
      },
      buildings: buildings.map(mapBuildingSummary),
      latestCalls: latestLogs.map(mapGuestLog),
      fallbackCalls: fallbackLogs.map(mapGuestLog)
    });
  });

  router.get('/locations', async (req, res) => {
    if (!hasSuperAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const provinces = await listProvincesWithDistricts(prisma);
    res.json(provinces);
  });

  router.get('/buildings', async (req, res) => {
    if (!hasAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const buildingIds = await resolveAccessibleBuildingIds(req);
    const buildings = await prisma.building.findMany({
      where: {
        id: { in: buildingIds.length > 0 ? buildingIds : impossibleIds() }
      },
      include: buildingSummaryInclude,
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }]
    });

    res.json({
      data: buildings.map(mapBuildingSummary)
    });
  });

  router.get('/buildings/:buildingId', async (req, res) => {
    const { buildingId } = req.params;

    if (!(await ensureBuildingAccess(req, buildingId))) {
      res.status(403).json({ message: 'Bu site için erişim izniniz yok.' });
      return;
    }

    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      include: buildingDetailInclude
    });

    if (!building) {
      res.status(404).json({ message: 'İlgili site kaydı bulunamadı.' });
      return;
    }

    res.json({
      data: mapBuildingDetail(building)
    });
  });

  router.patch('/buildings/:buildingId', async (req, res) => {
    const { buildingId } = req.params;

    if (!hasSuperAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const input = updateBuildingSchema.parse(req.body);
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      include: {
        district: {
          include: {
            province: true
          }
        }
      }
    });

    if (!building) {
      res.status(404).json({ message: 'İlgili site kaydı bulunamadı.' });
      return;
    }

    const existingBuilding = await prisma.building.findFirst({
      where: {
        id: { not: building.id },
        districtId: building.districtId,
        name: {
          equals: input.name,
          mode: 'insensitive'
        }
      },
      select: {
        id: true
      }
    });

    if (existingBuilding) {
      res.status(409).json({ message: 'Bu ilçe içinde aynı adla kayıtlı başka bir site var.' });
      return;
    }

    const updatedBuilding = await prisma.building.update({
      where: { id: building.id },
      data: {
        name: input.name,
        slug: `${slugify(input.name)}-${building.district.province.code}-${building.district.code}-${building.code}`
      },
      include: buildingSummaryInclude
    });

    res.json({
      data: mapBuildingSummary(updatedBuilding)
    });
  });

  router.patch('/blocks/:blockId', async (req, res) => {
    const { blockId } = req.params;

    if (!hasSuperAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const input = updateBlockSchema.parse(req.body);
    const block = await prisma.block.findUnique({
      where: { id: blockId },
      include: {
        apartments: {
          include: {
            units: true
          }
        }
      }
    });

    if (!block) {
      res.status(404).json({ message: 'İlgili blok kaydı bulunamadı.' });
      return;
    }

    const duplicateBlock = await prisma.block.findFirst({
      where: {
        id: { not: block.id },
        buildingId: block.buildingId,
        name: {
          equals: input.name,
          mode: 'insensitive'
        }
      },
      select: {
        id: true
      }
    });

    if (duplicateBlock) {
      res.status(409).json({ message: 'Bu site içinde aynı adla kayıtlı başka bir blok var.' });
      return;
    }

    const updatedBlock = await prisma.$transaction(async (tx) => {
      const nextBlock = await tx.block.update({
        where: { id: block.id },
        data: {
          name: input.name
        }
      });

      for (const apartment of block.apartments) {
        for (const unit of apartment.units) {
          await tx.unit.update({
            where: { id: unit.id },
            data: {
              label: createUnitLabel(nextBlock.name, apartment.name, unit.floorNumber, unit.number)
            }
          });
        }
      }

      return nextBlock;
    });

    res.json({
      data: {
        id: updatedBlock.id,
        name: updatedBlock.name
      }
    });
  });

  router.patch('/apartments/:apartmentId', async (req, res) => {
    const { apartmentId } = req.params;

    if (!hasSuperAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const input = updateApartmentSchema.parse(req.body);
    const apartment = await prisma.apartment.findUnique({
      where: { id: apartmentId },
      include: {
        block: true,
        units: true
      }
    });

    if (!apartment) {
      res.status(404).json({ message: 'İlgili apartman kaydı bulunamadı.' });
      return;
    }

    const duplicateApartment = await prisma.apartment.findFirst({
      where: {
        id: { not: apartment.id },
        blockId: apartment.blockId,
        name: {
          equals: input.name,
          mode: 'insensitive'
        }
      },
      select: {
        id: true
      }
    });

    if (duplicateApartment) {
      res.status(409).json({ message: 'Bu blok içinde aynı adla kayıtlı başka bir apartman var.' });
      return;
    }

    const updatedApartment = await prisma.$transaction(async (tx) => {
      const nextApartment = await tx.apartment.update({
        where: { id: apartment.id },
        data: {
          name: input.name
        }
      });

      for (const unit of apartment.units) {
        await tx.unit.update({
          where: { id: unit.id },
          data: {
            label: createUnitLabel(apartment.block.name, nextApartment.name, unit.floorNumber, unit.number)
          }
        });
      }

      return nextApartment;
    });

    res.json({
      data: {
        id: updatedApartment.id,
        name: updatedApartment.name
      }
    });
  });

  router.patch('/units/:unitId/resident', async (req, res) => {
    const { unitId } = req.params;

    if (!hasSuperAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const input = updateUnitResidentSchema.parse(req.body);
    const normalizedPhone = input.phone ? normalizePhoneInput(input.phone) : null;

    if (input.phone && !normalizedPhone) {
      res.status(400).json({ message: 'Telefon numarasını 5xxxxxxxxx biçiminde girin.' });
      return;
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        block: true,
        apartment: true,
        residents: {
          where: {
            role: 'RESIDENT'
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!unit || !unit.apartmentId || !unit.apartment) {
      res.status(404).json({ message: 'İlgili daire kaydı bulunamadı.' });
      return;
    }

    const currentResident = unit.residents[0] ?? null;

    if (normalizedPhone) {
      const duplicateResident = await prisma.user.findFirst({
        where: {
          id: currentResident ? { not: currentResident.id } : undefined,
          phone: normalizedPhone
        },
        select: {
          id: true,
          fullName: true
        }
      });

      if (duplicateResident) {
        res.status(409).json({ message: `${duplicateResident.fullName} için bu telefon numarası zaten kayıtlı.` });
        return;
      }
    }

    const updatedUnit = await prisma.$transaction(async (tx) => {
      const nextOwnerName = input.ownerName.trim();
      const targetPhone =
        normalizedPhone ??
        currentResident?.phone ??
        createGeneratedPhones(
          (
            await tx.user.findFirst({
              where: {
                role: 'RESIDENT',
                phone: {
                  startsWith: '+905'
                }
              },
              orderBy: {
                phone: 'desc'
              },
              select: {
                phone: true
              }
            })
          )?.phone ?? null,
          1
        )[0];

      if (currentResident) {
        await tx.user.update({
          where: { id: currentResident.id },
          data: {
            fullName: nextOwnerName,
            phone: targetPhone,
            buildingId: unit.buildingId,
            unitId: unit.id,
            isActive: true
          }
        });
      } else {
        await tx.user.create({
          data: {
            buildingId: unit.buildingId,
            unitId: unit.id,
            fullName: nextOwnerName,
            phone: targetPhone,
            role: 'RESIDENT',
            temporaryPassword: createTemporaryPassword(8),
            isActive: true
          }
        });
      }

      await tx.unit.update({
        where: { id: unit.id },
        data: {
          ownerName: nextOwnerName,
          isVacant: false
        }
      });

      return tx.unit.findUniqueOrThrow({
        where: { id: unit.id },
        include: {
          residents: {
            where: {
              role: 'RESIDENT'
            },
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      });
    });

    res.json({
      data: mapBuildingUnit(unit.block.name, unit.apartment.name, updatedUnit)
    });
  });

  router.post('/buildings', async (req, res) => {
    if (!hasSuperAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const input = createBuildingSchema.parse(req.body);
    const sortedUnits = [...input.units].sort((left, right) => {
      if (left.blockSequence !== right.blockSequence) {
        return left.blockSequence - right.blockSequence;
      }
      if (left.apartmentSequence !== right.apartmentSequence) {
        return left.apartmentSequence - right.apartmentSequence;
      }
      if (left.floorNumber !== right.floorNumber) {
        return left.floorNumber - right.floorNumber;
      }
      return left.unitNumber - right.unitNumber;
    });

    const district = await prisma.district.findUnique({
      where: { id: input.districtId },
      include: { province: true }
    });

    if (!district || district.provinceId !== input.provinceId) {
      res.status(400).json({ message: 'Seçilen il ve ilçe bilgileri eşleşmiyor.' });
      return;
    }

    const existingBuilding = await prisma.building.findFirst({
      where: {
        districtId: district.id,
        name: {
          equals: input.name.trim(),
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    if (existingBuilding) {
      res.status(409).json({ message: `${existingBuilding.name} adıyla kayıtlı bir site zaten var.` });
      return;
    }

    try {
      const createdBuildingId = await prisma.$transaction(
        async (tx) => {
          const [lastBuilding, lastResidentPhone] = await Promise.all([
            tx.building.findFirst({
              where: { districtId: district.id },
              orderBy: { siteNumber: 'desc' },
              select: { siteNumber: true }
            }),
            tx.user.findFirst({
              where: {
                role: 'RESIDENT',
                phone: {
                  startsWith: '+905'
                }
              },
              orderBy: {
                phone: 'desc'
              },
              select: {
                phone: true
              }
            })
          ]);

          const siteNumber = (lastBuilding?.siteNumber ?? 0) + 1;
          const code = createBuildingCode(siteNumber);

          const createdBuilding = await tx.building.create({
            data: {
              districtId: district.id,
              siteNumber,
              code,
              name: input.name,
              slug: `${slugify(input.name)}-${district.province.code}-${district.code}-${code}`,
              status: 'ONLINE',
              blocks: {
                create: input.blocks.map((blockInput, index) => ({
                  sequence: index + 1,
                  name: blockInput.name,
                  floorCount: input.floorCount
                }))
              }
            },
            include: {
              blocks: {
                select: {
                  id: true,
                  name: true,
                  sequence: true
                }
              }
            }
          });

          const blocksBySequence = new Map(createdBuilding.blocks.map((block) => [block.sequence, block] as const));

          const apartmentRows = input.blocks.flatMap((block, blockIndex) =>
            block.apartments.map((apartmentInput, apartmentIndex) => {
              const blockRecord = blocksBySequence.get(blockIndex + 1);

              if (!blockRecord) {
                throw new Error(`Blok sırası bulunamadı: ${blockIndex + 1}`);
              }

              return {
                buildingId: createdBuilding.id,
                blockId: blockRecord.id,
                sequence: apartmentIndex + 1,
                name: apartmentInput.name,
                code: createApartmentCode({
                  provinceCode: district.province.code,
                  districtCode: district.code,
                  siteNumber,
                  blockSequence: blockIndex + 1,
                  apartmentSequence: apartmentIndex + 1
                }),
                floorCount: input.floorCount,
                temporaryPassword: createTemporaryPassword(8)
              };
            })
          );

          await tx.apartment.createMany({
            data: apartmentRows
          });

          const createdApartments = await tx.apartment.findMany({
            where: { buildingId: createdBuilding.id },
            select: {
              id: true,
              blockId: true,
              sequence: true,
              name: true
            }
          });

          const apartmentMap = new Map(
            createdApartments.map((apartment) => {
              const block = createdBuilding.blocks.find((candidate) => candidate.id === apartment.blockId);
              return [`${block?.sequence ?? 0}:${apartment.sequence}`, apartment] as const;
            })
          );

          await tx.unit.createMany({
            data: sortedUnits.map((unit) => {
              const block = blocksBySequence.get(unit.blockSequence);
              const apartment = apartmentMap.get(`${unit.blockSequence}:${unit.apartmentSequence}`);

              if (!block || !apartment) {
                throw new Error(`Apartman kaydı bulunamadı: ${unit.blockSequence}/${unit.apartmentSequence}`);
              }

              return {
                buildingId: createdBuilding.id,
                blockId: block.id,
                apartmentId: apartment.id,
                floorNumber: unit.floorNumber,
                number: unit.unitNumber,
                code: createUnitCode({
                  provinceCode: district.province.code,
                  districtCode: district.code,
                  siteNumber,
                  blockSequence: unit.blockSequence,
                  apartmentSequence: unit.apartmentSequence,
                  floorNumber: unit.floorNumber,
                  unitNumber: unit.unitNumber
                }),
                label: createUnitLabel(block.name, apartment.name, unit.floorNumber, unit.unitNumber),
                ownerName: unit.isVacant ? null : unit.ownerName?.trim() ?? null,
                isVacant: unit.isVacant
              };
            })
          });

          const createdUnits = await tx.unit.findMany({
            where: { buildingId: createdBuilding.id },
            select: {
              id: true,
              apartmentId: true,
              floorNumber: true,
              number: true
            }
          });

          const unitIdByKey = new Map<string, string>(
            createdUnits.map((unit) => {
              const apartment = createdApartments.find((candidate) => candidate.id === unit.apartmentId);
              const block = apartment
                ? createdBuilding.blocks.find((candidate) => candidate.id === apartment.blockId)
                : undefined;
              return [
                `${block?.sequence ?? 0}:${apartment?.sequence ?? 0}:${unit.floorNumber}:${unit.number}`,
                unit.id
              ] as const;
            })
          );

          const occupiedUnits = sortedUnits.filter((unit) => !unit.isVacant && (unit.ownerName?.trim().length ?? 0) >= 2);

          if (occupiedUnits.length > 0) {
            const residentPhones = createGeneratedPhones(lastResidentPhone?.phone ?? null, occupiedUnits.length);

            await tx.user.createMany({
              data: occupiedUnits.map((unit, index) => {
                const unitId = unitIdByKey.get(
                  `${unit.blockSequence}:${unit.apartmentSequence}:${unit.floorNumber}:${unit.unitNumber}`
                );

                if (!unitId) {
                  throw new Error(
                    `Daire kaydı bulunamadı: ${unit.blockSequence}/${unit.apartmentSequence}/${unit.floorNumber}/${unit.unitNumber}`
                  );
                }

                return {
                  buildingId: createdBuilding.id,
                  unitId,
                  fullName: unit.ownerName!.trim(),
                  phone: residentPhones[index],
                  role: 'RESIDENT',
                  temporaryPassword: createTemporaryPassword(8),
                  isActive: true
                };
              })
            });
          }

          return createdBuilding.id;
        },
        {
          maxWait: 10000,
          timeout: 30000
        }
      );

      const building = await prisma.building.findUniqueOrThrow({
        where: { id: createdBuildingId },
        include: buildingSummaryInclude
      });

      res.status(201).json({
        data: mapBuildingSummary(building)
      });
    } catch (error) {
      console.error('Site oluşturma hatası:', error);
      res.status(400).json({ message: 'Site kaydedilirken bir sorun oluştu. Lütfen yeniden deneyin.' });
    }
  });

  router.get('/users', async (req, res) => {
    if (!hasSuperAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['SUPER_ADMIN', 'CONCIERGE']
        }
      },
      include: adminUserInclude,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }]
    });

    res.json({
      superAdmins: users.filter((user) => user.role === 'SUPER_ADMIN').map(mapAdminUser),
      concierges: users.filter((user) => user.role === 'CONCIERGE').map(mapAdminUser)
    });
  });

  router.patch('/users/:userId', async (req, res) => {
    if (!hasSuperAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const { userId } = req.params;
    const input = updateAdminUserSchema.parse(req.body);
    const normalizedPhone = normalizePhoneInput(input.phone);

    if (!normalizedPhone) {
      res.status(400).json({ message: 'Telefon numarasını 5xxxxxxxxx biçiminde girin.' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id: userId
      },
      include: adminUserInclude
    });

    if (!existingUser || !['SUPER_ADMIN', 'CONCIERGE'].includes(existingUser.role)) {
      res.status(404).json({ message: 'İlgili yönetici kaydı bulunamadı.' });
      return;
    }

    const duplicateUser = await prisma.user.findFirst({
      where: {
        id: { not: existingUser.id },
        phone: normalizedPhone
      },
      select: {
        id: true,
        fullName: true
      }
    });

    if (duplicateUser) {
      res.status(409).json({ message: `${duplicateUser.fullName} için bu telefon numarası zaten kayıtlı.` });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: existingUser.id
      },
      data: {
        fullName: input.name,
        phone: normalizedPhone,
        ...(existingUser.role === 'CONCIERGE'
          ? {
              assignedBuildings: {
                set: input.buildingIds.map((buildingId) => ({ id: buildingId }))
              }
            }
          : {})
      },
      include: adminUserInclude
    });

    res.json({
      data: mapAdminUser(updatedUser)
    });
  });

  router.post('/users', async (req, res) => {
    if (!hasSuperAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const input = createUserSchema.parse(req.body);
    const normalizedPhone = normalizePhoneInput(input.phone);

    if (!normalizedPhone) {
      res.status(400).json({ message: 'Telefon numarasını 5xxxxxxxxx biçiminde girin.' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        phone: normalizedPhone
      },
      select: {
        id: true,
        fullName: true
      }
    });

    if (existingUser) {
      res.status(409).json({ message: `${existingUser.fullName} için bu telefon numarası zaten kayıtlı.` });
      return;
    }

    try {
      const temporaryPassword = createTemporaryPassword(8);
      const createdUser = await prisma.user.create({
        data: {
          fullName: input.name,
          phone: normalizedPhone,
          role: input.role,
          temporaryPassword,
          isActive: true,
          ...(input.role === 'CONCIERGE' && input.buildingIds.length > 0
            ? {
                assignedBuildings: {
                  connect: input.buildingIds.map((buildingId) => ({ id: buildingId }))
                }
              }
            : {})
        },
        include: adminUserInclude
      });

      res.status(201).json({
        data: mapAdminUser(createdUser)
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({ message: 'Bu telefon numarası ile kayıtlı bir kullanıcı zaten var.' });
        return;
      }

      console.error('Kullanıcı oluşturma hatası:', error);
      res.status(400).json({ message: 'Kullanıcı oluşturulurken bir sorun oluştu.' });
    }
  });

  router.delete('/users/:userId', async (req, res) => {
    if (!hasSuperAdminAccess(req)) {
      res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekli.' });
      return;
    }

    const { userId } = req.params;
    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        role: true,
        fullName: true
      }
    });

    if (!targetUser || targetUser.role !== 'CONCIERGE') {
      res.status(404).json({ message: 'Silinecek danışman kaydı bulunamadı.' });
      return;
    }

    await prisma.user.delete({
      where: {
        id: targetUser.id
      }
    });

    res.json({
      message: `${targetUser.fullName} kaydı silindi.`
    });
  });

  router.post('/calls/:callId/manual-open', async (req, res) => {
    const { callId } = req.params;

    const existingCall = await prisma.guestLog.findUnique({
      where: { id: callId },
      select: {
        buildingId: true
      }
    });

    if (!existingCall || !(await ensureBuildingAccess(req, existingCall.buildingId))) {
      res.status(403).json({ message: 'Bu çağrı için işlem yetkiniz yok.' });
      return;
    }

    const updatedLog = await prisma.guestLog.update({
      where: { id: callId },
      data: {
        status: 'APPROVED',
        decidedAt: new Date()
      },
      include: guestLogInclude
    });

    const door = await sendOpenDoorCommand({ buildingId: updatedLog.buildingId, callId });
    const payload = mapGuestLog(updatedLog);

    emitTenantEvent(io, updatedLog.buildingId, 'guest-call:updated', payload);

    res.json({
      data: payload,
      door
    });
  });

  router.post('/calls/:callId/connect', async (req, res) => {
    const { callId } = req.params;

    const existingCall = await prisma.guestLog.findUnique({
      where: { id: callId },
      select: {
        buildingId: true
      }
    });

    if (!existingCall || !(await ensureBuildingAccess(req, existingCall.buildingId))) {
      res.status(403).json({ message: 'Bu çağrı için işlem yetkiniz yok.' });
      return;
    }

    const updatedLog = await prisma.guestLog.update({
      where: { id: callId },
      data: {
        status: 'ESCALATED',
        decidedAt: new Date()
      },
      include: guestLogInclude
    });

    const payload = mapGuestLog(updatedLog);
    emitTenantEvent(io, updatedLog.buildingId, 'guest-call:updated', payload);

    res.json({
      data: payload
    });
  });

  return router;
}
