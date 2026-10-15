// 驗證/解密 data.json：KAOHE_PASSWORD='密碼' node tools/decrypt.mjs data.json
import { readFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
const file = JSON.parse(readFileSync(process.argv[2] || 'data.json', 'utf8'));
const password = process.env.KAOHE_PASSWORD;
const b64 = s => new Uint8Array(Buffer.from(s, 'base64'));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(file.salt), iterations: file.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
const pt = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(file.iv) }, key, b64(file.ct))));
console.log('解密成功：', pt.months.map(m => m.month).join(', '), '| generatedAt', pt.generatedAt);
