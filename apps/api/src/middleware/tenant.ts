import type { NextFunction, Request, Response } from 'express';

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantId) {
    res.status(400).json({ message: 'Bina bağlamı belirlenemedi.' });
    return;
  }

  next();
}
