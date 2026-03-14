import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { syncTurkeyLocations } from './lib/location-seed.js';
import { prisma } from './lib/prisma.js';
import { requireAuth } from './middleware/auth.js';
import { requireTenant } from './middleware/tenant.js';
import { createAdminRouter } from './routes/admin.js';
import { createAuthRouter } from './routes/auth.js';
import { createGuestCallsRouter } from './routes/guest-calls.js';
import { healthRouter } from './routes/health.js';
import { residentsRouter } from './routes/residents.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.WEB_ORIGIN,
    credentials: true
  }
});

app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true
  })
);
app.use(express.json());

app.use(healthRouter);
app.use('/api/auth', createAuthRouter());
app.use('/api/admin', requireAuth, createAdminRouter(io));
app.use('/api/residents', requireAuth, requireTenant, residentsRouter);
app.use('/api/guest-calls', requireAuth, requireTenant, createGuestCallsRouter(io));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: error.issues[0]?.message ?? 'Form bilgilerini kontrol edip yeniden deneyin.'
    });
    return;
  }

  if (error instanceof Error) {
    console.error('[API Error]:', error);
    res.status(500).json({ message: 'İşlem tamamlanamadı. Lütfen yeniden deneyin.' });
    return;
  }

  res.status(500).json({ message: 'İşlem tamamlanamadı. Lütfen yeniden deneyin.' });
});

io.on('connection', (socket) => {
  const buildingId = typeof socket.handshake.query.buildingId === 'string' ? socket.handshake.query.buildingId : 'bldg-001';
  socket.join(buildingId);
  socket.emit('tenant:joined', { buildingId });
});

async function startServer() {
  await syncTurkeyLocations(prisma);

  server.listen(env.API_PORT, () => {
    console.log(`Online Kapıcı API listening on http://localhost:${env.API_PORT}`);
  });
}

void startServer().catch((error) => {
  console.error('[Startup Error]:', error);
  process.exit(1);
});
