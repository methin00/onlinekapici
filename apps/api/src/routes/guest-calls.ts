import { Router } from 'express';
import { z } from 'zod';
import type { Server } from 'socket.io';
import { emitTenantEvent } from '../lib/events.js';
import { formatUnitSummary } from '../lib/building-layout.js';
import { prisma } from '../lib/prisma.js';
import { sendOpenDoorCommand } from '../services/door-control.js';
import { notifyResident } from '../services/notifications.js';

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

function mapGuestLog(
  log: {
    id: string;
    buildingId: string;
    residentId: string | null;
    visitorName: string;
    visitorType: 'GUEST' | 'CARGO' | 'COURIER' | 'OTHER';
    status: 'WAITING' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
    createdAt: Date;
    decidedAt: Date | null;
    imageUrl: string | null;
    resident:
      | {
          fullName: string;
          unit:
            | {
                floorNumber: number;
                number: number;
                block: { name: string };
                apartment: { name: string } | null;
              }
            | null;
        }
      | null;
  }
) {
  return {
    id: log.id,
    buildingId: log.buildingId,
    residentId: log.residentId ?? '',
    residentName: log.resident?.fullName ?? 'Atanmamış',
    unitNumber: formatUnitNumber(log.resident?.unit ?? null),
    visitorLabel: log.visitorName,
    visitorType: log.visitorType.toLocaleLowerCase('en-US'),
    status: log.status.toLocaleLowerCase('en-US'),
    createdAt: log.createdAt.toISOString(),
    decidedAt: log.decidedAt?.toISOString(),
    imageUrl: log.imageUrl ?? undefined
  };
}

export function createGuestCallsRouter(io: Server) {
  const router = Router();

  const listQuerySchema = z.object({
    residentId: z.string().optional()
  });

  const createSchema = z.object({
    residentId: z.string().min(1),
    visitorLabel: z.string().trim().min(2).max(80),
    visitorType: z.enum(['guest', 'cargo', 'courier', 'other']),
    imageUrl: z.string().url().optional()
  });

  const decisionSchema = z.object({
    decision: z.enum(['approved', 'rejected', 'escalated'])
  });

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
  } as const;

  router.get('/', async (req, res) => {
    const { residentId } = listQuerySchema.parse(req.query);
    const calls = await prisma.guestLog.findMany({
      where: {
        buildingId: req.tenantId!,
        ...(residentId ? { residentId } : {}),
        ...(req.user?.role === 'TABLET' && req.user.apartmentId
          ? {
              resident: {
                is: {
                  unit: {
                    is: {
                      apartmentId: req.user.apartmentId
                    }
                  }
                }
              }
            }
          : {})
      },
      include: guestLogInclude,
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      data: calls.map(mapGuestLog)
    });
  });

  router.post('/', async (req, res) => {
    const input = createSchema.parse(req.body);
    const resident = await prisma.user.findUnique({
      where: { id: input.residentId },
      include: {
        unit: {
          include: {
            block: true,
            apartment: true
          }
        }
      }
    });

    const residentApartmentId = resident?.unit?.apartmentId ?? null;
    const tabletApartmentId = req.user?.role === 'TABLET' ? req.user.apartmentId ?? null : null;

    if (
      !resident ||
      resident.role !== 'RESIDENT' ||
      resident.buildingId !== req.tenantId ||
      (tabletApartmentId && residentApartmentId !== tabletApartmentId)
    ) {
      res.status(404).json({ message: 'İlgili sakin kaydı bulunamadı.' });
      return;
    }

    const call = await prisma.guestLog.create({
      data: {
        buildingId: resident.buildingId!,
        residentId: resident.id,
        visitorName: input.visitorLabel,
        visitorType: input.visitorType.toUpperCase() as 'GUEST' | 'CARGO' | 'COURIER' | 'OTHER',
        imageUrl: input.imageUrl
      },
      include: guestLogInclude
    });

    const notification = await notifyResident({
      residentName: resident.fullName,
      phone: resident.phone,
      visitorLabel: input.visitorLabel,
      unitNumber: formatUnitNumber(resident.unit)
    });

    const payload = mapGuestLog(call);
    emitTenantEvent(io, resident.buildingId!, 'guest-call:created', payload);

    res.status(201).json({
      data: payload,
      notification
    });
  });

  router.post('/:callId/decision', async (req, res) => {
    const { callId } = req.params;
    const { decision } = decisionSchema.parse(req.body);

    const existingCall = await prisma.guestLog.findUnique({
      where: { id: callId },
      include: guestLogInclude
    });

    if (!existingCall || existingCall.buildingId !== req.tenantId) {
      res.status(404).json({ message: 'İlgili çağrı kaydı bulunamadı.' });
      return;
    }

    if (req.user?.role === 'RESIDENT' && existingCall.residentId !== req.user.sub) {
      res.status(403).json({ message: 'Bu çağrı için işlem yetkiniz yok.' });
      return;
    }

    if (req.user?.role === 'TABLET') {
      res.status(403).json({ message: 'Tablet ekranı çağrı kararı veremez.' });
      return;
    }

    const updatedCall = await prisma.guestLog.update({
      where: { id: callId },
      data: {
        status: decision.toUpperCase() as 'APPROVED' | 'REJECTED' | 'ESCALATED',
        decidedAt: new Date()
      },
      include: guestLogInclude
    });

    let door = null;
    if (decision === 'approved') {
      door = await sendOpenDoorCommand({ buildingId: req.tenantId!, callId });
    }

    const payload = mapGuestLog(updatedCall);
    emitTenantEvent(io, req.tenantId!, 'guest-call:updated', payload);

    res.json({
      data: payload,
      door
    });
  });

  return router;
}
