import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  API_KEY: z.string().min(8).default('dev-online-kapici-key'),
  JWT_SECRET: z.string().min(16).default('replace-with-a-long-random-string'),
  ESP32_GATEWAY_URL: z.string().url().default('http://localhost:4010/mock-door'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional()
});

export const env = envSchema.parse(process.env);

