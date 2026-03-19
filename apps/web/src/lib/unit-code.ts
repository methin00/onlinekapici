export type UnitCodeSite = {
  id: string;
  name: string;
  district: string;
  city: string;
};

export type UnitCodeBuilding = {
  id: string;
  siteId: string;
  name: string;
};

export type UnitCodeUnit = {
  id: string;
  buildingId: string;
  unitNumber: string;
};

function normalizeCodeFragment(value: string) {
  return value
    .toLocaleUpperCase('tr-TR')
    .replaceAll('Ç', 'C')
    .replaceAll('Ğ', 'G')
    .replaceAll('İ', 'I')
    .replaceAll('Ö', 'O')
    .replaceAll('Ş', 'S')
    .replaceAll('Ü', 'U')
    .replace(/[^A-Z0-9]+/g, '');
}

function codeFragment(value: string, length: number, fallback: string) {
  const normalized = normalizeCodeFragment(value).slice(0, length);
  return normalized || fallback;
}

function unitNumberCode(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits) {
    return digits.slice(-3).padStart(3, '0');
  }

  return codeFragment(value, 3, '001');
}

export function buildBaseUnitCode(parts: {
  city: string;
  district: string;
  siteName: string;
  buildingName: string;
  unitNumber: string;
}) {
  return [
    codeFragment(parts.city, 3, 'CTY'),
    codeFragment(parts.district, 3, 'DST'),
    codeFragment(parts.siteName, 4, 'SITE'),
    codeFragment(parts.buildingName, 3, 'BLK'),
    unitNumberCode(parts.unitNumber)
  ].join('-');
}

export function buildUnitCodeMap(
  units: UnitCodeUnit[],
  buildings: UnitCodeBuilding[],
  sites: UnitCodeSite[]
) {
  const buildingsById = new Map(buildings.map((building) => [building.id, building]));
  const sitesById = new Map(sites.map((site) => [site.id, site]));
  const groupedCodes = new Map<string, string[]>();

  for (const unit of units) {
    const building = buildingsById.get(unit.buildingId);
    const site = building ? sitesById.get(building.siteId) : undefined;

    if (!building || !site) {
      groupedCodes.set(unit.id, [unit.id]);
      continue;
    }

    const baseCode = buildBaseUnitCode({
      city: site.city,
      district: site.district,
      siteName: site.name,
      buildingName: building.name,
      unitNumber: unit.unitNumber
    });

    const ids = groupedCodes.get(baseCode) ?? [];
    ids.push(unit.id);
    groupedCodes.set(baseCode, ids);
  }

  const unitCodeMap = new Map<string, string>();

  for (const [baseCode, unitIds] of groupedCodes.entries()) {
    if (unitIds.length === 1) {
      unitCodeMap.set(unitIds[0], baseCode);
      continue;
    }

    unitIds
      .slice()
      .sort((left, right) => left.localeCompare(right, 'tr-TR'))
      .forEach((unitId, index) => {
        unitCodeMap.set(unitId, index === 0 ? baseCode : `${baseCode}-${index + 1}`);
      });
  }

  return unitCodeMap;
}
