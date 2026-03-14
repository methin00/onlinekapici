import type { Server } from 'socket.io';

export function emitTenantEvent(io: Server, buildingId: string, event: string, payload: unknown) {
  io.to(buildingId).emit(event, payload);
}

