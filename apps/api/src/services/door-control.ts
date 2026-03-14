import { env } from '../config/env.js';

export async function sendOpenDoorCommand(payload: { buildingId: string; callId: string }) {
  try {
    const response = await fetch(env.ESP32_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.API_KEY
      },
      body: JSON.stringify({
        action: 'OPEN_DOOR',
        buildingId: payload.buildingId,
        callId: payload.callId,
        requestedAt: new Date().toISOString()
      })
    });

    return {
      ok: response.ok,
      mode: 'http' as const
    };
  } catch {
    return {
      ok: true,
      mode: 'simulated' as const
    };
  }
}

