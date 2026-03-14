import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { Pool } from 'pg';

config();

function createPoolOptions() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL tanımlı değil.');
  }

  const connectionUrl = new URL(databaseUrl);
  const sslMode = connectionUrl.searchParams.get('sslmode');

  if (sslMode) {
    connectionUrl.searchParams.delete('sslmode');
  }

  return {
    connectionString: connectionUrl.toString(),
    ssl: sslMode ? { rejectUnauthorized: false } : undefined
  };
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

const pool = globalForPrisma.prismaPool ?? new Pool(createPoolOptions());
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error']
  });

export async function disconnectPrisma() {
  await prisma.$disconnect();

  if (!globalForPrisma.prismaPool) {
    await pool.end();
  }
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaPool = pool;
}
