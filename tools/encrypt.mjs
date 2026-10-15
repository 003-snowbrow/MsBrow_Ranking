// 用密碼把 source/months.json 加密成網站用的 data.json（AES-256-GCM，金鑰由 PBKDF2-SHA256 推導）
// 用法：KAOHE_PASSWORD='密碼' node tools/encrypt.mjs [source/months.json] [data.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
const src = process.argv[2] || 'source/months.json';
const out = process.argv[3] || 'data.json';
const password = process.env.KAOHE_PASSWORD;
if (!password) { console.error('請以環境變數 KAOHE_PASSWORD 提供密碼'); process.exit(1); }
const months = JSON.parse(readFileSync(src, 'utf8'));
const payload = JSON.stringify({ months, generatedAt: new Date().toISOString() });
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
const iter = 300000;
const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(payload)));
const b64 = u8 => Buffer.from(u8).toString('base64');
writeFileSync(out, JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
console.log(`已寫入 ${out}：${months.length} 個月，${ct.length} bytes`);
