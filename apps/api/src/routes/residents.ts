import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { formatUnitSummary } from '../lib/building-layout.js';
import { prisma } from '../lib/prisma.js';

export const residentsRouter = Router();

const querySchema = z.object({
  query: z.string().optional().default('')
});

const residentInclude = {
  unit: {
    include: {
      block: true,
      apartment: true
    }
  }
} as const;

type ResidentRecord = Prisma.UserGetPayload<{ include: typeof residentInclude }>;

function formatUnitNumber(
  unit:
    | {
        code: string;
        floorNumber: number;
        number: number;
        block: { name: string };
        apartment: { name: string } | null;
      }
    | null
    | undefined
) {
  if (!unit) {
    return 'Atanmamış';
  }

  return formatUnitSummary(
    unit.block.name,
    unit.apartment?.name ?? 'Apartman',
    unit.floorNumber,
    unit.number
  );
}

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mapResident(resident: ResidentRecord | null) {
  if (!resident) {
    return null;
  }

  return {
    id: resident.id,
    buildingId: resident.buildingId ?? '',
    apartmentId: resident.unit?.apartmentId ?? undefined,
    unitId: resident.unitId ?? undefined,
    unitNumber: formatUnitNumber(resident.unit),
    unitCode: resident.unit?.code ?? undefined,
    fullName: resident.fullName,
    phone: resident.phone,
    role: resident.role.toLocaleLowerCase('en-US')
  };
}

async function getResidentOrThrow(residentId: string) {
  const resident = await prisma.user.findUnique({
    where: { id: residentId },
    include: residentInclude
  });

  if (!resident || resident.role !== 'RESIDENT' || !resident.buildingId) {
    throw new Error('İlgili sakin kaydı bulunamadı.');
  }

  return resident;
}

function canAccessResident(requestUserId: string | undefined, residentId: string, role: string) {
  if (role === 'TABLET') {
    return false;
  }

  return role !== 'RESIDENT' || requestUserId === residentId;
}

residentsRouter.get('/search', async (req, res) => {
  const { query } = querySchema.parse(req.query);
  const currentUser = req.user;

  if (!currentUser) {
    res.status(401).json({ message: 'Oturum doğrulanamadı.' });
    return;
  }

  if (currentUser.role === 'RESIDENT') {
    const resident = await prisma.user.findUnique({
      where: { id: currentUser.sub },
      include: residentInclude
    });

    const data = resident ? [mapResident(resident)].filter(Boolean) : [];
    res.json({
      data,
      total: data.length
    });
    return;
  }

  const normalizedQuery = normalizeSearch(query.trim());
  const residents = await prisma.user.findMany({
    where: {
      role: 'RESIDENT',
      isActive: true,
      buildingId: req.tenantId ?? undefined,
      ...(currentUser.role === 'TABLET' && currentUser.apartmentId
        ? {
            unit: {
              is: {
                apartmentId: currentUser.apartmentId
              }
            }
          }
        : {})
    },
    include: residentInclude,
    orderBy: {
      fullName: 'asc'
    }
  });

  const data = residents
    .filter((resident) => {
      if (!normalizedQuery) {
        return true;
      }

      const searchableValue = `${resident.fullName} ${formatUnitNumber(resident.unit)} ${resident.unit?.code ?? ''}`;
      return normalizeSearch(searchableValue).includes(normalizedQuery);
    })
    .map((resident) => mapResident(resident))
    .filter(Boolean);

  res.json({
    data,
    total: data.length
  });
});

residentsRouter.get('/:residentId/overview', async (req, res) => {
  const currentUser = req.user;

  if (!currentUser || !canAccessResident(currentUser.sub, req.params.residentId, currentUser.role)) {
    res.status(403).json({ message: 'Bu kayıt için erişim izniniz yok.' });
    return;
  }

  const resident = await getResidentOrThrow(req.params.residentId);
  if (req.tenantId && resident.buildingId !== req.tenantId && currentUser.role !== 'SUPER_ADMIN') {
    res.status(403).json({ message: 'Bu kayıt için erişim izniniz yok.' });
    return;
  }

  const [waitingCalls, historyCalls] = await Promise.all([
    prisma.guestLog.findMany({
      where: {
        residentId: resident.id,
        status: 'WAITING'
      },
      orderBy: { createdAt: 'desc' },
      take: 8
    }),
    prisma.guestLog.findMany({
      where: {
        residentId: resident.id,
        status: {
          in: ['APPROVED', 'REJECTED', 'ESCALATED']
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        resident: {
          include: residentInclude
        }
      }
    })
  ]);

  const activityLogs = historyCalls
    .map((call) => ({
      id: call.id,
      buildingId: call.buildingId,
      residentId: call.residentId ?? resident.id,
      visitorLabel: call.visitorName,
      summary:
        call.status === 'APPROVED'
          ? 'Kapı açıldı'
          : call.status === 'REJECTED'
            ? 'Çağrı reddedildi'
            : 'Danışmaya aktarıldı',
      type:
        call.status === 'APPROVED'
          ? 'approved'
          : call.status === 'REJECTED'
            ? 'rejected'
            : 'escalated',
      timestamp: (call.decidedAt ?? call.createdAt).toISOString()
    }))
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

  res.json({
    data: {
      resident: mapResident(resident),
      waitingCalls: waitingCalls.map((call) => ({
        id: call.id,
        buildingId: call.buildingId,
        residentId: call.residentId ?? resident.id,
        residentName: resident.fullName,
        unitNumber: formatUnitNumber(resident.unit),
        visitorLabel: call.visitorName,
        visitorType: call.visitorType.toLocaleLowerCase('en-US'),
        status: call.status.toLocaleLowerCase('en-US'),
        createdAt: call.createdAt.toISOString(),
        decidedAt: call.decidedAt?.toISOString(),
        imageUrl: call.imageUrl ?? undefined
      })),
      activityLogs: activityLogs.slice(0, 8)
    }
  });
});
