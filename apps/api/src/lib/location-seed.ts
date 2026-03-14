import type { Prisma, PrismaClient } from '@prisma/client';
import { turkeyLocations } from '../data/turkey-locations.js';

type LocationClient = PrismaClient | Prisma.TransactionClient;

const TOTAL_PROVINCES = turkeyLocations.length;
const TOTAL_DISTRICTS = turkeyLocations.reduce((total, province) => total + province.districts.length, 0);
let locationsReady = false;

export async function syncTurkeyLocations(client: LocationClient) {
  if (locationsReady) {
    return;
  }

  const [provinceCount, districtCount, buildingCount] = await Promise.all([
    client.province.count(),
    client.district.count(),
    client.building.count()
  ]);

  if (provinceCount === TOTAL_PROVINCES && districtCount === TOTAL_DISTRICTS) {
    locationsReady = true;
    return;
  }

  if (buildingCount === 0) {
    if (districtCount > 0) {
      await client.district.deleteMany();
    }

    if (provinceCount > 0) {
      await client.province.deleteMany();
    }

    await client.province.createMany({
      data: turkeyLocations.map((province) => ({
        code: province.code,
        name: province.name
      })),
      skipDuplicates: true
    });

    const provinces = await client.province.findMany({
      select: {
        id: true,
        code: true
      }
    });
    const provinceIdByCode = new Map(provinces.map((province) => [province.code, province.id]));

    await client.district.createMany({
      data: turkeyLocations.flatMap((province) => {
        const provinceId = provinceIdByCode.get(province.code);

        if (!provinceId) {
          throw new Error(`İl kaydı bulunamadı: ${province.name}`);
        }

        return province.districts.map((district) => ({
          code: district.code,
          name: district.name,
          provinceId
        }));
      }),
      skipDuplicates: true
    });

    locationsReady = true;
    return;
  }

  for (const province of turkeyLocations) {
    await client.province.upsert({
      where: { code: province.code },
      update: { name: province.name },
      create: {
        code: province.code,
        name: province.name
      }
    });
  }

  const provinces = await client.province.findMany({
    select: {
      id: true,
      code: true
    }
  });
  const provinceIdByCode = new Map(provinces.map((province) => [province.code, province.id]));

  for (const province of turkeyLocations) {
    const provinceId = provinceIdByCode.get(province.code);

    if (!provinceId) {
      throw new Error(`İl kaydı bulunamadı: ${province.name}`);
    }

    for (const district of province.districts) {
      await client.district.upsert({
        where: { code: district.code },
        update: {
          name: district.name,
          provinceId
        },
        create: {
          code: district.code,
          name: district.name,
          provinceId
        }
      });
    }
  }

  locationsReady = true;
}

export async function listProvincesWithDistricts(client: LocationClient) {
  await syncTurkeyLocations(client);

  return client.province.findMany({
    orderBy: { code: 'asc' },
    include: {
      districts: {
        orderBy: { name: 'asc' }
      }
    }
  });
}
