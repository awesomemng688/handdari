import { randomBytes, scrypt as rawScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { need } from './store.mjs';
const scrypt = promisify(rawScrypt);
export const digest = value => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password) {
  need(typeof password === 'string' && password.length >= 12 && password.length <= 256, 'Нууц үг 12–256 тэмдэгт байна.');
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [salt, hash] = encoded.split(':');
  const actual = await scrypt(password, salt, 64), expected = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export const sessionToken = () => randomBytes(32).toString('base64url');
