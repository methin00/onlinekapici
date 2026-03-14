import {
  createApartmentCode,
  createBuildingCode,
  createUnitCode,
  createUnitLabel
} from '../src/lib/building-layout.js';
import { createTemporaryPassword } from '../src/lib/auth-credentials.js';
import { syncTurkeyLocations } from '../src/lib/location-seed.js';
import { disconnectPrisma, prisma } from '../src/lib/prisma.js';

async function ensureApartmentHierarchy() {
  const blocks = await prisma.block.findMany({
    include: {
      building: {
        include: {
          district: {
            include: {
              province: true
            }
          }
        }
      },
      apartments: true,
      units: {
        orderBy: [{ floorNumber: 'asc' }, { number: 'asc' }]
      }
    },
    orderBy: [{ buildingId: 'asc' }, { sequence: 'asc' }]
  });

  for (const block of blocks) {
    const primaryApartment =
      block.apartments.find((apartment) => apartment.sequence === 1) ??
      (await prisma.apartment.create({
        data: {
          buildingId: block.buildingId,
          blockId: block.id,
          sequence: 1,
          name: `${block.name} Apartman`,
          code: createApartmentCode({
            provinceCode: block.building.district.province.code,
            districtCode: block.building.district.code,
            siteNumber: block.building.siteNumber,
            blockSequence: block.sequence,
            apartmentSequence: 1
          }),
          floorCount: block.floorCount,
          temporaryPassword: createTemporaryPassword(8)
        }
      }));

    const apartmentsById = new Map(
      [...block.apartments, primaryApartment].map((apartment) => [apartment.id, apartment] as const)
    );

    for (const apartment of apartmentsById.values()) {
      const expectedCode = createApartmentCode({
        provinceCode: block.building.district.province.code,
        districtCode: block.building.district.code,
        siteNumber: block.building.siteNumber,
        blockSequence: block.sequence,
        apartmentSequence: apartment.sequence
      });

      if (
        apartment.code !== expectedCode ||
        apartment.floorCount !== block.floorCount ||
        !apartment.temporaryPassword
      ) {
        await prisma.apartment.update({
          where: { id: apartment.id },
          data: {
            code: expectedCode,
            floorCount: block.floorCount,
            temporaryPassword: apartment.temporaryPassword ?? createTemporaryPassword(8)
          }
        });
      }
    }

    for (const unit of block.units) {
      const apartment = unit.apartmentId ? apartmentsById.get(unit.apartmentId) ?? primaryApartment : primaryApartment;
      const expectedCode = createUnitCode({
        provinceCode: block.building.district.province.code,
        districtCode: block.building.district.code,
        siteNumber: block.building.siteNumber,
        blockSequence: block.sequence,
        apartmentSequence: apartment.sequence,
        floorNumber: unit.floorNumber,
        unitNumber: unit.number
      });
      const expectedLabel = createUnitLabel(block.name, apartment.name, unit.floorNumber, unit.number);

      if (unit.apartmentId !== apartment.id || unit.code !== expectedCode || unit.label !== expectedLabel) {
        await prisma.unit.update({
          where: { id: unit.id },
          data: {
            apartmentId: apartment.id,
            code: expectedCode,
            label: expectedLabel
          }
        });
      }
    }
  }
}

async function main() {
  await syncTurkeyLocations(prisma);
  await ensureApartmentHierarchy();

  const province = await prisma.province.findUnique({
    where: { code: '34' }
  });
  const district = await prisma.district.findUnique({
    where: { code: '2016' }
  });

  if (!province || !district) {
    throw new Error('Varsayılan il veya ilçe kaydı bulunamadı.');
  }

  const building = await prisma.building.upsert({
    where: { slug: 'yildiz-sitesi-001' },
    update: {
      districtId: district.id,
      siteNumber: 1,
      code: createBuildingCode(1),
      name: 'Yıldız Sitesi'
    },
    create: {
      districtId: district.id,
      siteNumber: 1,
      code: createBuildingCode(1),
      slug: 'yildiz-sitesi-001',
      name: 'Yıldız Sitesi',
      status: 'ONLINE'
    }
  });

  const blockA = await prisma.block.upsert({
    where: {
      buildingId_sequence: {
        buildingId: building.id,
        sequence: 1
      }
    },
    update: {
      name: 'A',
      floorCount: 5
    },
    create: {
      buildingId: building.id,
      sequence: 1,
      name: 'A',
      floorCount: 5
    }
  });

  const blockB = await prisma.block.upsert({
    where: {
      buildingId_sequence: {
        buildingId: building.id,
        sequence: 2
      }
    },
    update: {
      name: 'B',
      floorCount: 5
    },
    create: {
      buildingId: building.id,
      sequence: 2,
      name: 'B',
      floorCount: 5
    }
  });

  const apartmentA = await prisma.apartment.upsert({
    where: {
      blockId_sequence: {
        blockId: blockA.id,
        sequence: 1
      }
    },
    update: {
      name: 'Lale',
      code: createApartmentCode({
        provinceCode: province.code,
        districtCode: district.code,
        siteNumber: building.siteNumber,
        blockSequence: blockA.sequence,
        apartmentSequence: 1
      }),
      floorCount: 5,
      temporaryPassword: 'TABLET123',
      passwordHash: null,
      passwordChangedAt: null
    },
    create: {
      buildingId: building.id,
      blockId: blockA.id,
      sequence: 1,
      name: 'Lale',
      code: createApartmentCode({
        provinceCode: province.code,
        districtCode: district.code,
        siteNumber: building.siteNumber,
        blockSequence: blockA.sequence,
        apartmentSequence: 1
      }),
      floorCount: 5,
      temporaryPassword: 'TABLET123'
    }
  });

  const apartmentB = await prisma.apartment.upsert({
    where: {
      blockId_sequence: {
        blockId: blockB.id,
        sequence: 1
      }
    },
    update: {
      name: 'Nil',
      code: createApartmentCode({
        provinceCode: province.code,
        districtCode: district.code,
        siteNumber: building.siteNumber,
        blockSequence: blockB.sequence,
        apartmentSequence: 1
      }),
      floorCount: 5,
      temporaryPassword: 'TABLET124',
      passwordHash: null,
      passwordChangedAt: null
    },
    create: {
      buildingId: building.id,
      blockId: blockB.id,
      sequence: 1,
      name: 'Nil',
      code: createApartmentCode({
        provinceCode: province.code,
        districtCode: district.code,
        siteNumber: building.siteNumber,
        blockSequence: blockB.sequence,
        apartmentSequence: 1
      }),
      floorCount: 5,
      temporaryPassword: 'TABLET124'
    }
  });

  for (const apartment of [apartmentA, apartmentB]) {
    const block = apartment.blockId === blockA.id ? blockA : blockB;

    for (let floorNumber = 1; floorNumber <= 5; floorNumber += 1) {
      for (let unitNumber = 1; unitNumber <= 2; unitNumber += 1) {
        const code = createUnitCode({
          provinceCode: province.code,
          districtCode: district.code,
          siteNumber: building.siteNumber,
          blockSequence: block.sequence,
          apartmentSequence: apartment.sequence,
          floorNumber,
          unitNumber
        });

        await prisma.unit.upsert({
          where: { code },
          update: {
            buildingId: building.id,
            blockId: block.id,
            apartmentId: apartment.id,
            floorNumber,
            number: unitNumber,
            label: createUnitLabel(block.name, apartment.name, floorNumber, unitNumber),
            ownerName:
              block.sequence === 1 && apartment.sequence === 1 && floorNumber === 1 && unitNumber === 1
                ? 'Ahmet Yılmaz'
                : null,
            isVacant: !(block.sequence === 1 && apartment.sequence === 1 && floorNumber === 1 && unitNumber === 1)
          },
          create: {
            buildingId: building.id,
            blockId: block.id,
            apartmentId: apartment.id,
            floorNumber,
            number: unitNumber,
            code,
            label: createUnitLabel(block.name, apartment.name, floorNumber, unitNumber),
            ownerName:
              block.sequence === 1 && apartment.sequence === 1 && floorNumber === 1 && unitNumber === 1
                ? 'Ahmet Yılmaz'
                : null,
            isVacant: !(block.sequence === 1 && apartment.sequence === 1 && floorNumber === 1 && unitNumber === 1)
          }
        });
      }
    }
  }

  await prisma.doorDevice.upsert({
    where: { serialNo: 'ESP32_YILDIZ_001' },
    update: {
      buildingId: building.id,
      status: 'ONLINE'
    },
    create: {
      buildingId: building.id,
      serialNo: 'ESP32_YILDIZ_001',
      status: 'ONLINE'
    }
  });

  await prisma.user.upsert({
    where: { phone: '+905550000000' },
    update: {
      fullName: 'Süper Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      temporaryPassword: 'ADMIN123',
      passwordHash: null,
      passwordChangedAt: null
    },
    create: {
      fullName: 'Süper Admin',
      phone: '+905550000000',
      role: 'SUPER_ADMIN',
      temporaryPassword: 'ADMIN123'
    }
  });

  await prisma.user.upsert({
    where: { phone: '+905551111111' },
    update: {
      fullName: 'Yıldız Danışma',
      role: 'CONCIERGE',
      temporaryPassword: 'DANIS123',
      passwordHash: null,
      passwordChangedAt: null,
      assignedBuildings: {
        connect: { id: building.id }
      }
    },
    create: {
      fullName: 'Yıldız Danışma',
      phone: '+905551111111',
      role: 'CONCIERGE',
      temporaryPassword: 'DANIS123',
      assignedBuildings: {
        connect: { id: building.id }
      }
    }
  });

  const primaryUnit = await prisma.unit.findFirst({
    where: {
      buildingId: building.id,
      blockId: blockA.id,
      apartmentId: apartmentA.id,
      floorNumber: 1,
      number: 1
    }
  });

  if (primaryUnit) {
    const existingResident = await prisma.user.findFirst({
      where: {
        role: 'RESIDENT',
        OR: [{ unitId: primaryUnit.id }, { phone: '+905552222222' }, { phone: '+905000000001' }]
      },
      select: {
        id: true
      }
    });

    if (existingResident) {
      await prisma.user.update({
        where: { id: existingResident.id },
        data: {
          fullName: 'Ahmet Yılmaz',
          phone: '+905000000001',
          role: 'RESIDENT',
          buildingId: building.id,
          unitId: primaryUnit.id,
          temporaryPassword: 'DAIRE123',
          passwordHash: null,
          passwordChangedAt: null
        }
      });
    } else {
      await prisma.user.create({
        data: {
          fullName: 'Ahmet Yılmaz',
          phone: '+905000000001',
          role: 'RESIDENT',
          buildingId: building.id,
          unitId: primaryUnit.id,
          temporaryPassword: 'DAIRE123'
        }
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
