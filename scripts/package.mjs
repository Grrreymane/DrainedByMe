import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, sha256, readLocal } from './build.mjs';
import { verify } from './verify.mjs';

const directories = ['src', 'scripts', 'tests', 'docs', '.github'];
const rootFiles = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'ASSET-LICENSE.md', 'LICENSE', 'package.json', 'index.html', '.gitignore', '.gitattributes'];
const extensions = new Set(['.js', '.cjs', '.mjs', '.css', '.html', '.json', '.md', '.txt', '.yml', '.yaml', '.webp', '.svg', '.png', '.jpg', '.jpeg', '.woff', '.woff2']);
const excluded = /^(?:outputs?|dist|cache|workbuddy|node_modules|logs?|secrets?|credentials?|coverage|tmp|temp|responses?|service-responses?|generation-responses?)(?:[._-]|$)/i;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function safeName(name) {
  assert(typeof name === 'string' && name.length > 0 && !/[\\:\u0000-\u001f\u007f]/.test(name) && !name.startsWith('/'), 'ZIP 条目名不安全');
  assert(name.split('/').every((part) => part && part !== '.' && part !== '..' && !/[. ]$/.test(part)), 'ZIP 条目包含路径穿越');
}

export function createZip(entries) {
  assert(entries.length > 0 && entries.length < 65535, 'ZIP 条目数超出非 ZIP64 范围');
  const locals = [];
  const centrals = [];
  const used = new Set();
  let offset = 0;
  for (const { name, data } of entries) {
    safeName(name);
    assert(!used.has(name.toLowerCase()), 'ZIP 条目名称重复'); used.add(name.toLowerCase());
    const filename = Buffer.from(name, 'utf8');
    assert(filename.length <= 65535 && data.length < 0xffffffff, 'ZIP 条目过大');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(0x81a40000, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, filename, data);
    centrals.push(central, filename);
    offset += local.length + filename.length + data.length;
    assert(offset < 0xffffffff, 'ZIP 超出非 ZIP64 大小限制');
  }
  const centralDirectory = Buffer.concat(centrals);
  assert(offset + centralDirectory.length + 22 < 0xffffffff, 'ZIP 超出非 ZIP64 大小限制');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

export function validateZip(zip, entries) {
  assert(zip.length >= 22, 'ZIP 被截断');
  const eocd = zip.length - 22;
  assert.equal(zip.readUInt32LE(eocd), 0x06054b50, 'ZIP 缺少结束目录');
  assert.equal(zip.readUInt16LE(eocd + 4), 0);
  assert.equal(zip.readUInt16LE(eocd + 6), 0);
  assert.equal(zip.readUInt16LE(eocd + 20), 0);
  const count = zip.readUInt16LE(eocd + 10);
  assert.equal(zip.readUInt16LE(eocd + 8), count);
  assert.equal(count, entries.length, 'ZIP 条目数不符');
  const centralStart = zip.readUInt32LE(eocd + 16);
  const centralSize = zip.readUInt32LE(eocd + 12);
  assert.equal(centralStart + centralSize, eocd, 'ZIP 中央目录大小错误');
  let cursor = centralStart;
  let nextLocal = 0;
  const seen = new Set();
  for (let index = 0; index < count; index += 1) {
    assert(cursor + 46 <= eocd, '中央目录被截断');
    assert.equal(zip.readUInt32LE(cursor), 0x02014b50);
    assert.equal(zip.readUInt16LE(cursor + 8), 0x0800);
    assert.equal(zip.readUInt16LE(cursor + 10), 0);
    assert.equal(zip.readUInt16LE(cursor + 12), 0);
    assert.equal(zip.readUInt16LE(cursor + 14), 0x0021);
    assert.equal(zip.readUInt16LE(cursor + 30), 0);
    assert.equal(zip.readUInt16LE(cursor + 32), 0);
    assert.equal(zip.readUInt16LE(cursor + 34), 0);
    const crc = zip.readUInt32LE(cursor + 16);
    const size = zip.readUInt32LE(cursor + 24);
    assert.equal(zip.readUInt32LE(cursor + 20), size);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const offset = zip.readUInt32LE(cursor + 42);
    assert(cursor + 46 + nameLength <= eocd, '中央目录条目名被截断');
    const nameBytes = zip.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = nameBytes.toString('utf8');
    safeName(name);
    assert(Buffer.from(name, 'utf8').equals(nameBytes), 'ZIP 文件名不是规范 UTF-8');
    assert(!seen.has(name.toLowerCase()), 'ZIP 重复文件名'); seen.add(name.toLowerCase());
    assert.equal(offset, nextLocal, 'ZIP 本地条目有间隙或重叠');
    assert(offset + 30 + nameLength + size <= centralStart, 'ZIP 本地条目越界');
    assert.equal(zip.readUInt32LE(offset), 0x04034b50);
    assert.equal(zip.readUInt16LE(offset + 6), 0x0800);
    assert.equal(zip.readUInt16LE(offset + 8), 0);
    assert.equal(zip.readUInt16LE(offset + 10), 0);
    assert.equal(zip.readUInt16LE(offset + 12), 0x0021);
    assert.equal(zip.readUInt32LE(offset + 14), crc);
    assert.equal(zip.readUInt32LE(offset + 18), size);
    assert.equal(zip.readUInt32LE(offset + 22), size);
    assert.equal(zip.readUInt16LE(offset + 26), nameLength);
    assert.equal(zip.readUInt16LE(offset + 28), 0);
    assert(zip.subarray(offset + 30, offset + 30 + nameLength).equals(nameBytes), '本地与中央目录文件名不同');
    const data = zip.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    assert.equal(crc32(data), crc, `${name} CRC32 错误`);
    assert.equal(name, entries[index].name, 'ZIP 文件顺序错误');
    assert(data.equals(entries[index].data), `${name} ZIP 内容与输入不一致`);
    nextLocal = offset + 30 + nameLength + size;
    cursor += 46 + nameLength;
  }
  assert.equal(nextLocal, centralStart);
  assert.equal(cursor, eocd);
  return { files: count, bytes: zip.length, sha256: sha256(zip), crc32Checked: count };
}

async function collect(directory, files) {
  const stat = await fs.lstat(path.join(root, directory));
  assert(stat.isDirectory() && !stat.isSymbolicLink(), `${directory} 必须是实际项目目录`);
  for (const entry of (await fs.readdir(path.join(root, directory), { withFileTypes: true })).sort((a, b) => compare(a.name, b.name))) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && excluded.test(entry.name)) continue;
    if (entry.isFile() && /^(?:logs?|secrets?|credentials?|responses?|service-responses?|generation-responses?)(?:[._-]|$)/i.test(entry.name)) continue;
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(name, files);
    else if (entry.isFile() && extensions.has(path.posix.extname(name).toLowerCase())) files.push(name);
  }
}

function inspectText(name, bytes) {
  if (!/\.(?:js|cjs|mjs|css|html|json|md|txt|yml|yaml)$/.test(name) && !rootFiles.includes(name)) return;
  const text = bytes.toString('utf8');
  assert(!/(?:[a-z]:[\\/]+Users[\\/]|[\\/]Users[\\/]|[\\/]home[\\/][^\s/]+[\\/])/i.test(text), `${name} 含本机用户路径`);
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), `${name} 含私钥`);
  assert(!/["']?(?:access_token|refresh_token|clientTempToken|api_key|secret_access_key)["']?\s*[:=]\s*["'][A-Za-z0-9_+\/-]{16,}/i.test(text), `${name} 疑似含凭据或服务响应`);
}

export async function packageSource() {
  const names = [];
  for (const directory of directories) await collect(directory, names);
  for (const name of rootFiles) {
    const stat = await fs.lstat(path.join(root, name));
    assert(stat.isFile() && !stat.isSymbolicLink(), `${name} 必须是实际项目文件`);
    names.push(name);
  }
  const entries = [];
  for (const name of names.sort(compare)) {
    const data = await readLocal(name);
    inspectText(name, data);
    entries.push({ name, data });
  }
  let offlineExists = false;
  try { offlineExists = (await fs.stat(path.join(root, 'outputs/token-afterhours.html'))).isFile(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (offlineExists) {
    const result = await verify();
    assert(result.ok, '离线成品验证失败，拒绝加入源码包；请重新构建并验证');
    entries.push({ name: 'release/token-afterhours.html', data: await readLocal('outputs/token-afterhours.html') });
  }
  entries.sort((a, b) => compare(a.name, b.name));
  const zip = createZip(entries);
  validateZip(zip, entries);
  await fs.mkdir(path.join(root, 'outputs'), { recursive: true });
  const filename = path.join(root, 'outputs/token-afterhours-source.zip');
  await fs.writeFile(filename, zip);
  const result = validateZip(await fs.readFile(filename), entries);
  console.log(`源码 ZIP 完成：${result.files} 项，${result.bytes} 字节，${result.crc32Checked} 项 CRC32 均通过；${offlineExists ? '含已通过静态验证的离线成品' : '仅源码，尚无离线成品'}。`);
  console.log(`SHA-256：${result.sha256}`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packageSource().catch((error) => { console.error(`打包失败：${error.code || String(error.message).split('\n')[0]}`); process.exitCode = 1; });
}
