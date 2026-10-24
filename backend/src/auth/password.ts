import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const prefix = 'scrypt:32768:8:3';
// Unknown accounts still perform the same password derivation as known accounts.
const dummyHash = `${prefix}:${'00'.repeat(16)}:${'00'.repeat(64)}`;

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `${prefix}:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  hash?: string,
): Promise<boolean> {
  const validFormat =
    typeof hash === 'string' &&
    /^scrypt:32768:8:3:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash);
  const parts = (validFormat ? hash : dummyHash).split(':');
  const actual = await derive(password, parts[4]);
  const matches = timingSafeEqual(actual, Buffer.from(parts[5], 'hex'));
  return validFormat && matches;
}
