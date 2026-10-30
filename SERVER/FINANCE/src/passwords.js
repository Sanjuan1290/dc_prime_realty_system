import {randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {problem} from './domain.js';
export const sessionHash = s => createHash('sha256').update(s).digest('hex');
export function hashPassword(password,salt=randomBytes(16).toString('hex')) {
  if(typeof password!=='string'||password.length<12||password.length>128)throw problem('WEAK_PASSWORD','Password must contain 12–128 characters.');
  return `scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`;
}
export function verifyPassword(password,encoded) {
  const [kind,salt,hash]=String(encoded||'').split('$');
  if(kind!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt||'')||!/^[a-f0-9]{128}$/.test(hash||''))return false;
  const candidate=scryptSync(String(password),salt,64);
  return timingSafeEqual(candidate,Buffer.from(hash,'hex'));
}
