const SITE_SEQUENCE_WIDTH = 3;
const BLOCK_SEQUENCE_WIDTH = 2;
const APARTMENT_SEQUENCE_WIDTH = 2;
const FLOOR_SEQUENCE_WIDTH = 2;
const UNIT_SEQUENCE_WIDTH = 3;

export const APARTMENT_CODE_LENGTH =
  2 + 4 + SITE_SEQUENCE_WIDTH + BLOCK_SEQUENCE_WIDTH + APARTMENT_SEQUENCE_WIDTH;

export type ApartmentCodeInput = {
  provinceCode: string;
  districtCode: string;
  siteNumber: number;
  blockSequence: number;
  apartmentSequence: number;
};

export type UnitCodeInput = ApartmentCodeInput & {
  floorNumber: number;
  unitNumber: number;
};

export function padSequence(value: number, width: number) {
  return String(value).padStart(width, '0');
}

export function createBuildingCode(siteNumber: number) {
  return padSequence(siteNumber, SITE_SEQUENCE_WIDTH);
}

export function createApartmentCode(input: ApartmentCodeInput) {
  return [
    input.provinceCode,
    input.districtCode,
    createBuildingCode(input.siteNumber),
    padSequence(input.blockSequence, BLOCK_SEQUENCE_WIDTH),
    padSequence(input.apartmentSequence, APARTMENT_SEQUENCE_WIDTH)
  ].join('');
}

export function createUnitCode(input: UnitCodeInput) {
  return [
    createApartmentCode(input),
    padSequence(input.floorNumber, FLOOR_SEQUENCE_WIDTH),
    padSequence(input.unitNumber, UNIT_SEQUENCE_WIDTH)
  ].join('');
}

export function createApartmentLabel(blockName: string, apartmentName: string) {
  return `${blockName} Blok / ${apartmentName} Apartman`;
}

export function createUnitLabel(blockName: string, apartmentName: string, floorNumber: number, unitNumber: number) {
  return `${createApartmentLabel(blockName, apartmentName)} / ${floorNumber}. Kat / Daire ${padSequence(unitNumber, UNIT_SEQUENCE_WIDTH)}`;
}

export function formatUnitSummary(blockName: string, apartmentName: string, floorNumber: number, unitNumber: number) {
  return `${blockName}/${apartmentName}-${padSequence(floorNumber, FLOOR_SEQUENCE_WIDTH)}-${padSequence(unitNumber, UNIT_SEQUENCE_WIDTH)}`;
}

export function normalizeApartmentCode(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === APARTMENT_CODE_LENGTH ? digits : null;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
