import { Router } from 'express';
import type { Apartment, Prisma, UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  createApartmentLabel,
  createUnitLabel,
  formatUnitSummary,
  normalizeApartmentCode
} from '../lib/building-layout.js';
import { normalizePhoneInput, toLoginPhone, hashPassword, verifyPassword } from '../lib/auth-credentials.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const loginSchema = z
  .object({
    identifier: z.string().min(4).optional(),
    phone: z.string().min(4).optional(),
    password: z.string().min(4),
    role: z.enum(['super_admin', 'building_admin', 'concierge', 'resident', 'tablet']).optional()
  })
  .superRefine((input, ctx) => {
    if (!(input.identifier ?? input.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Giriş bilgisi zorunludur.',
        path: ['identifier']
      });
    }
  });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(4),
  newPassword: z.string().min(8).max(64)
});

const authUserInclude = {
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
} as const;

const authApartmentInclude = {
  building: {
    include: {
      district: {
        include: {
          province: true
        }
      }
    }
  },
  block: true
} as const;

type AuthUserRecord = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;
type AuthApartmentRecord = Prisma.ApartmentGetPayload<{ include: typeof authApartmentInclude }>;

function toClientRole(role: UserRole) {
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

function createUserToken(user: AuthUserRecord) {
  const primaryBuildingId = user.buildingId ?? user.assignedBuildings[0]?.id ?? null;

  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      buildingId: primaryBuildingId,
      apartmentId: user.unit?.apartmentId ?? null,
      unitId: user.unitId ?? null,
      phone: user.phone,
      fullName: user.fullName
    },
    env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function createApartmentToken(apartment: AuthApartmentRecord) {
  return jwt.sign(
    {
      sub: apartment.id,
      role: 'TABLET',
      buildingId: apartment.buildingId,
      apartmentId: apartment.id,
      unitId: null,
      phone: apartment.code,
      fullName: `${createApartmentLabel(apartment.block.name, apartment.name)} Tableti`
    },
    env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function mapUserSession(user: AuthUserRecord) {
  const primaryBuildingId = user.buildingId ?? user.assignedBuildings[0]?.id;

  return {
    id: user.id,
    fullName: user.fullName,
    role: toClientRole(user.role),
    phone: user.phone,
    loginId: toLoginPhone(user.phone),
    buildingId: primaryBuildingId ?? undefined,
    apartmentId: user.unit?.apartmentId ?? undefined,
    unitId: user.unitId ?? undefined,
    building:
      user.building
        ? {
            id: user.building.id,
            name: user.building.name,
            district: user.building.district.name,
            province: user.building.district.province.name
          }
        : undefined,
    apartment:
      user.unit?.apartment
        ? {
            id: user.unit.apartment.id,
            name: user.unit.apartment.name,
            code: user.unit.apartment.code,
            blockName: user.unit.block.name,
            label: createApartmentLabel(user.unit.block.name, user.unit.apartment.name)
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
            ),
            summary: formatUnitSummary(
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
    })),
    mustChangePassword: Boolean(user.temporaryPassword && !user.passwordChangedAt)
  };
}

function mapApartmentSession(apartment: AuthApartmentRecord) {
  return {
    id: apartment.id,
    fullName: `${createApartmentLabel(apartment.block.name, apartment.name)} Tableti`,
    role: 'tablet' as const,
    phone: apartment.code,
    loginId: apartment.code,
    buildingId: apartment.buildingId,
    apartmentId: apartment.id,
    building: {
      id: apartment.building.id,
      name: apartment.building.name,
      district: apartment.building.district.name,
      province: apartment.building.district.province.name
    },
    apartment: {
      id: apartment.id,
      name: apartment.name,
      code: apartment.code,
      blockName: apartment.block.name,
      label: createApartmentLabel(apartment.block.name, apartment.name)
    },
    assignedBuildings: [],
    mustChangePassword: Boolean(apartment.temporaryPassword && !apartment.passwordChangedAt)
  };
}

async function getAuthUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: authUserInclude
  }) as Promise<AuthUserRecord | null>;
}

async function getAuthApartment(apartmentId: string) {
  return prisma.apartment.findUnique({
    where: { id: apartmentId },
    include: authApartmentInclude
  }) as Promise<AuthApartmentRecord | null>;
}

async function verifyUserPassword(user: AuthUserRecord, password: string) {
  if (user.temporaryPassword && !user.passwordChangedAt) {
    return user.temporaryPassword === password;
  }

  return verifyPassword(password, user.passwordHash);
}

async function verifyApartmentPassword(apartment: Apartment, password: string) {
  if (apartment.temporaryPassword && !apartment.passwordChangedAt) {
    return apartment.temporaryPassword === password;
  }

  return verifyPassword(password, apartment.passwordHash);
}

export function createAuthRouter() {
  const router = Router();

  router.post('/login', async (req, res) => {
    const input = loginSchema.parse(req.body);
    const identifier = input.identifier ?? input.phone ?? '';
    const wantsTablet = input.role === 'tablet';

    if (wantsTablet) {
      const normalizedCode = normalizeApartmentCode(identifier);

      if (!normalizedCode) {
        res.status(400).json({ message: 'Apartman kimliğini eksiksiz girin.' });
        return;
      }

      const apartment = await prisma.apartment.findUnique({
        where: { code: normalizedCode },
        include: authApartmentInclude
      });

      if (!apartment) {
        res.status(401).json({ message: 'Apartman kimliği veya şifre hatalı.' });
        return;
      }

      const isValid = await verifyApartmentPassword(apartment, input.password);
      if (!isValid) {
        res.status(401).json({ message: 'Apartman kimliği veya şifre hatalı.' });
        return;
      }

      await prisma.apartment.update({
        where: { id: apartment.id },
        data: {
          lastLoginAt: new Date()
        }
      });

      const refreshedApartment = await getAuthApartment(apartment.id);
      if (!refreshedApartment) {
        res.status(401).json({ message: 'Tablet oturumu başlatılamadı.' });
        return;
      }

      res.json({
        token: createApartmentToken(refreshedApartment),
        user: mapApartmentSession(refreshedApartment)
      });
      return;
    }

    const normalizedPhone = normalizePhoneInput(identifier);
    if (!normalizedPhone) {
      res.status(400).json({ message: 'Telefon numarasını 5xxxxxxxxx biçiminde girin.' });
      return;
    }

    const user = (await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: authUserInclude
    })) as AuthUserRecord | null;

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Telefon numarası veya şifre hatalı.' });
      return;
    }

    const isValid = await verifyUserPassword(user, input.password);
    if (!isValid) {
      res.status(401).json({ message: 'Telefon numarası veya şifre hatalı.' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date()
      }
    });

    const refreshedUser = await getAuthUser(user.id);
    if (!refreshedUser) {
      res.status(401).json({ message: 'Oturum başlatılamadı.' });
      return;
    }

    res.json({
      token: createUserToken(refreshedUser),
      user: mapUserSession(refreshedUser)
    });
  });

  router.use(requireAuth);

  router.get('/me', async (req, res) => {
    const principalId = req.user?.sub;

    if (!principalId || !req.user) {
      res.status(401).json({ message: 'Oturum doğrulanamadı.' });
      return;
    }

    if (req.user.role === 'TABLET') {
      const apartment = await getAuthApartment(principalId);
      if (!apartment) {
        res.status(401).json({ message: 'Oturum doğrulanamadı.' });
        return;
      }

      res.json({
        user: mapApartmentSession(apartment)
      });
      return;
    }

    const user = await getAuthUser(principalId);
    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Oturum doğrulanamadı.' });
      return;
    }

    res.json({
      user: mapUserSession(user)
    });
  });

  router.post('/change-password', async (req, res) => {
    const principalId = req.user?.sub;

    if (!principalId || !req.user) {
      res.status(401).json({ message: 'Oturum doğrulanamadı.' });
      return;
    }

    const input = changePasswordSchema.parse(req.body);

    if (req.user.role === 'TABLET') {
      const apartment = await getAuthApartment(principalId);

      if (!apartment) {
        res.status(401).json({ message: 'Oturum doğrulanamadı.' });
        return;
      }

      const isValid = await verifyApartmentPassword(apartment, input.currentPassword);
      if (!isValid) {
        res.status(400).json({ message: 'Mevcut şifre doğrulanamadı.' });
        return;
      }

      const passwordHash = await hashPassword(input.newPassword);
      const updatedApartment = await prisma.apartment.update({
        where: { id: apartment.id },
        data: {
          passwordHash,
          temporaryPassword: null,
          passwordChangedAt: new Date()
        },
        include: authApartmentInclude
      });

      res.json({
        token: createApartmentToken(updatedApartment),
        user: mapApartmentSession(updatedApartment)
      });
      return;
    }

    const user = await getAuthUser(principalId);
    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Oturum doğrulanamadı.' });
      return;
    }

    const isValid = await verifyUserPassword(user, input.currentPassword);
    if (!isValid) {
      res.status(400).json({ message: 'Mevcut şifre doğrulanamadı.' });
      return;
    }

    const passwordHash = await hashPassword(input.newPassword);

    const updatedUser = (await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        temporaryPassword: null,
        passwordChangedAt: new Date()
      },
      include: authUserInclude
    })) as AuthUserRecord;

    res.json({
      token: createUserToken(updatedUser),
      user: mapUserSession(updatedUser)
    });
  });

  return router;
}
