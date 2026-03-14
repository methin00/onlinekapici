import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { RequestUser } from '../types.js';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      tenantId?: string;
    }
  }
}

function readRole(value: string | undefined): RequestUser['role'] {
  switch (value) {
    case 'SUPER_ADMIN':
      return 'SUPER_ADMIN';
    case 'BUILDING_ADMIN':
    case 'building_admin':
      return 'BUILDING_ADMIN';
    case 'CONCIERGE':
    case 'concierge':
      return 'CONCIERGE';
    case 'RESIDENT':
    case 'resident':
      return 'RESIDENT';
    case 'TABLET':
    case 'tablet':
      return 'TABLET';
    default:
      return 'CONCIERGE';
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.header('x-api-key');
  const authHeader = req.header('authorization');

  if (apiKey && apiKey === env.API_KEY) {
    const buildingId = req.header('x-building-id') ?? 'bldg-001';
    req.user = {
      sub: 'api-key-user',
      role: readRole(req.header('x-user-role') ?? undefined),
      buildingId,
      phone: '+905000000000',
      fullName: 'Gelistirici'
    };
    req.tenantId = buildingId;
    next();
    return;
  }

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as RequestUser;
      req.user = payload;
      req.tenantId = payload.buildingId ?? undefined;
      next();
      return;
    } catch {
      res.status(401).json({ message: 'Oturum doğrulanamadı.' });
      return;
    }
  }

  res.status(401).json({ message: 'Yetkilendirme icin gecerli bir API anahtari veya erisim belirteci gerekli.' });
}
