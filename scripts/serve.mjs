import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.yml': 'text/plain; charset=utf-8', '.yaml': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4',
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.wasm': 'application/wasm'
};

function httpError(status) { return Object.assign(new Error(String(status)), { status }); }

function forbiddenSegment(segment) {
  return segment.startsWith('.') || /[\\:\u0000-\u001f\u007f]/.test(segment) || /[. ]$/.test(segment) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment);
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

export async function resolveRequest(requestURL, root = projectRoot) {
  if (typeof requestURL !== 'string' || !requestURL.startsWith('/') || requestURL.startsWith('//')) throw httpError(400);
  let decoded;
  try { decoded = decodeURIComponent(requestURL.split('?')[0]); } catch { throw httpError(400); }
  if (/[\u0000-\u001f\u007f]/.test(decoded)) throw httpError(400);
  const parts = decoded.split('/').filter(Boolean);
  if (parts.some(forbiddenSegment) || decoded.includes('\\')) throw httpError(403);
  const canonicalRoot = await fs.realpath(root);
  let candidate = path.resolve(canonicalRoot, ...parts);
  if (!inside(canonicalRoot, candidate)) throw httpError(403);
  try {
    candidate = await fs.realpath(candidate);
    if (!inside(canonicalRoot, candidate)) throw httpError(403);
    const relative = path.relative(canonicalRoot, candidate);
    if (relative && relative.split(path.sep).some(forbiddenSegment)) throw httpError(403);
    let stat = await fs.stat(candidate);
    if (stat.isDirectory()) {
      candidate = await fs.realpath(path.join(candidate, 'index.html'));
      if (!inside(canonicalRoot, candidate) || path.relative(canonicalRoot, candidate).split(path.sep).some(forbiddenSegment)) throw httpError(403);
      stat = await fs.stat(candidate);
    }
    if (!stat.isFile()) throw httpError(404);
    return { filename: candidate, mime: mimeTypes[path.extname(candidate).toLowerCase()] || 'application/octet-stream' };
  } catch (error) {
    if (error.status) throw error;
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) throw httpError(404);
    if (['EACCES', 'EPERM', 'ELOOP'].includes(error.code)) throw httpError(403);
    throw httpError(500);
  }
}

export function parsePort(args) {
  if (!args.length) return 4173;
  if (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1])) throw new Error('用法：node scripts/serve.mjs [--port 4173]');
  const port = Number(args[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口必须是 1–65535 的整数');
  return port;
}

export function createStaticServer(root = projectRoot) {
  return http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    const fail = (status) => {
      const message = { 400: '请求地址无效', 403: '禁止访问', 404: '文件不存在', 405: '仅允许 GET 和 HEAD', 500: '服务器读取失败' }[status] || '请求失败';
      const bytes = Buffer.from(`${message}\n`);
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD'); fail(405); return;
    }
    let file;
    try {
      const target = await resolveRequest(request.url, root);
      file = await fs.open(target.filename, 'r');
      const stat = await file.stat();
      if (!stat.isFile()) throw httpError(404);
      response.writeHead(200, { 'Content-Type': target.mime, 'Content-Length': stat.size });
      if (request.method === 'HEAD') { await file.close(); file = null; response.end(); return; }
      const stream = file.createReadStream({ autoClose: true });
      file = null;
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch (error) {
      if (file) await file.close().catch(() => {});
      if (!response.headersSent) fail(error.status || (error.code === 'ENOENT' ? 404 : 500));
      else response.destroy();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const port = parsePort(process.argv.slice(2));
    const server = createStaticServer();
    server.on('error', (error) => { console.error(`静态服务失败：${error.code || '未知错误'}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`本地静态服务：http://127.0.0.1:${port}`));
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      server.close();
      server.closeAllConnections();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
