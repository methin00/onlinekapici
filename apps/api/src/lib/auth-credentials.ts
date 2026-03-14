import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const GENERATED_PHONE_START = 5000000000n;
const GENERATED_PHONE_LIMIT = 5999999999n;
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function loginDigitsToIntlPhone(loginDigits: bigint) {
  return `+90${loginDigits.toString()}`;
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function normalizePhoneInput(value: string) {
  const digits = phoneDigits(value);

  if (digits.length === 10 && digits.startsWith('5')) {
    return `+90${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('90') && digits[2] === '5') {
    return `+${digits}`;
  }

  return null;
}

export function toLoginPhone(value: string) {
  const digits = phoneDigits(value);
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function createTemporaryPassword(length = 8) {
  return Array.from(randomBytes(length))
    .map((byte) => TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length])
    .join('')
    .slice(0, length);
}

function parseGeneratedPhone(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const digits = toLoginPhone(value);
  if (digits.length !== 10 || !digits.startsWith('5')) {
    return null;
  }

  return BigInt(digits);
}

export function createGeneratedPhones(lastPhone: string | null | undefined, count: number) {
  const phones: string[] = [];
  let currentValue = parseGeneratedPhone(lastPhone) ?? GENERATED_PHONE_START - 1n;

  for (let index = 0; index < count; index += 1) {
    currentValue += 1n;

    if (currentValue > GENERATED_PHONE_LIMIT) {
      throw new Error('Oluşturulabilecek otomatik sakin telefonu kalmadı.');
    }

    phones.push(loginDigitsToIntlPhone(currentValue));
  }

  return phones;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) {
    return false;
  }

  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }

  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');

  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
