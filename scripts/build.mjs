import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const assetNames = ['codex', 'claude', 'cursor', 'workbuddy', 'room', 'cover',
  ...['codex', 'claude', 'cursor', 'workbuddy'].flatMap(id => ['shallow', 'deep', 'greedy'].map(mode => `${id}_${mode}`)),
  ...['hunger', 'household', 'codex', 'claude', 'cursor', 'workbuddy'].map(id => `ending_${id}`)];
export const scriptPaths = ['src/data/story.js', 'src/engine/core.js', 'src/ui/app.js'];
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function assertPublishable(text, label) {
  assert(!/(?:[a-z]:[\\/]+Users[\\/]|[\\/]Users[\\/]|[\\/]home[\\/][^\s/]+[\\/]|file:\/\/(?:\/[a-z]:|\/(?:Users|home)\/))/i.test(text), `${label} 含本机用户路径`);
  assert(!/\b(?:clientTempToken|access_token|refresh_token|secret_access_key|Authorization\s*:\s*Bearer)\b/i.test(text), `${label} 疑似含凭据或生成服务响应`);
}

export function checkWebp(bytes, label) {
  assert(bytes.length >= 20, `${label} 长度不足`);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${label} 缺少 RIFF 标头`);
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${label} 不是 WEBP`);
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, `${label} RIFF 声明长度不符`);
  let offset = 12;
  let image = false;
  while (offset < bytes.length) {
    assert(offset + 8 <= bytes.length, `${label} 分块标头被截断`);
    const type = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    assert(end + (length % 2) <= bytes.length, `${label} 分块数据被截断`);
    if (type === 'VP8 ' || type === 'VP8L' || type === 'ANMF') image = true;
    offset = end + (length % 2);
  }
  assert.equal(offset, bytes.length, `${label} 分块边界错误`);
  assert(image, `${label} 缺少图像分块`);
  return { riffBytes: bytes.readUInt32LE(4) + 8, chunksComplete: true };
}

export async function readLocal(relative) {
  const absolute = path.join(root, relative);
  let real;
  try { real = await fs.realpath(absolute); } catch { throw new Error(`缺少输入文件：${relative}`); }
  const rel = path.relative(root, real);
  assert(rel && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel), `${relative} 超出项目边界`);
  return fs.readFile(real);
}

function once(text, token, value) {
  assert.equal(text.split(token).length - 1, 1, `${token} 必须恰好出现一次`);
  assert(!value.includes('@@TOK_'), `${token} 的值含嵌套占位符`);
  return text.replace(token, () => value);
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? match[1] ?? match[2] ?? match[3] : null;
}

async function markdownFiles(directory = 'docs') {
  const found = [];
  for (const entry of (await fs.readdir(path.join(root, directory), { withFileTypes: true })).sort((a, b) => order(a.name, b.name))) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) found.push(...await markdownFiles(name));
    else if (entry.isFile() && /\.md$/i.test(name)) found.push(name);
  }
  return found;
}

function inlineMarkdown(text, filename, anchors) {
  const pattern = /`([^`]+)`|(!?)\[([^\]]*)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let result = '';
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    result += escapeHTML(text.slice(offset, match.index));
    if (match[1] !== undefined) result += `<code>${escapeHTML(match[1])}</code>`;
    else if (match[5] !== undefined) result += `<strong>${escapeHTML(match[5])}</strong>`;
    else {
      const label = escapeHTML(match[3]);
      const target = match[4];
      const local = path.posix.normalize(path.posix.join(path.posix.dirname(filename), target.split('#')[0]));
      let href = anchors.get(local) ? `#${anchors.get(local)}` : '';
      if (/^https?:\/\//i.test(target) && !/[\u0000-\u0020\u007f]/.test(target)) {
        try { const url = new URL(target); if (!url.username && !url.password) href = url.href; } catch { /* 无效链接只显示标签。 */ }
      }
      result += match[2] ? `<span class="image-note">[图片：${label}]</span>` : href ? `<a href="${escapeHTML(href)}" rel="noreferrer noopener">${label}</a>` : label;
    }
    offset = match.index + match[0].length;
  }
  return result + escapeHTML(text.slice(offset));
}

function renderMarkdown(markdown, filename, anchor, anchors) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const headings = [];
  let paragraph = [];
  let list = null;
  let fence = null;
  let code = [];
  const inline = (text) => inlineMarkdown(text, filename, anchors);
  const flush = () => { if (paragraph.length) out.push(`<p>${inline(paragraph.join('\n'))}</p>`); paragraph = []; };
  const closeList = () => { if (list) out.push(`</${list}>`); list = null; };
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) {
        out.push(`<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`); fence = null; code = [];
      } else code.push(line);
      continue;
    }
    if (marker) { flush(); closeList(); fence = marker[1]; continue; }
    if (!line.trim()) { flush(); closeList(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush(); closeList();
      const id = `${anchor}-h${headings.length + 1}`;
      const level = Math.min(6, heading[1].length + 1);
      headings.push({ id, text: heading[2] });
      out.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && cells(lines[i + 1]).every((cell) => /^:?-{3,}:?$/.test(cell))) {
      flush(); closeList();
      const headers = cells(line);
      out.push(`<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>`);
      i += 1;
      while (i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].trim()) {
        i += 1;
        out.push(`<tr>${cells(lines[i]).map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`);
      }
      out.push('</tbody></table></div>');
      continue;
    }
    const item = line.match(/^\s*(?:([-+*])|\d+\.)\s+(.+)$/);
    if (item) {
      flush(); const type = item[1] ? 'ul' : 'ol';
      if (list !== type) { closeList(); out.push(`<${type}>`); list = type; }
      out.push(`<li>${inline(item[2])}</li>`); continue;
    }
    closeList();
    if (/^>\s?/.test(line)) { flush(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
    paragraph.push(line);
  }
  flush(); closeList();
  if (fence) out.push(`<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`);
  return { html: out.join('\n'), headings };
}

async function designDossier(version) {
  const preferred = ['docs/design/GDD.md', 'docs/design/NARRATIVE.md', 'docs/RESEARCH.md', 'docs/ARCHITECTURE.md'];
  const files = [...new Set([...preferred, ...await markdownFiles()])];
  const anchors = new Map(files.map((file, index) => [file, `doc-${index + 1}`]));
  const sections = [];
  const navigation = [];
  const sources = [];
  for (const file of files) {
    const bytes = await readLocal(file);
    const text = bytes.toString('utf8');
    assertPublishable(text, file);
    const anchor = anchors.get(file);
    const rendered = renderMarkdown(text, file, anchor, anchors);
    const title = text.match(/^#\s+(.+)$/m)?.[1] || path.posix.basename(file);
    sections.push(`<section id="${anchor}"><div class="source">${escapeHTML(file)}</div>${rendered.html}</section>`);
    navigation.push(`<li><a href="#${anchor}">${escapeHTML(title)}</a><ul>${rendered.headings.filter((_, index) => index > 0).map((heading) => `<li><a href="#${heading.id}">${escapeHTML(heading.text)}</a></li>`).join('')}</ul></li>`);
    sources.push({ name: file, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>完蛋，我被 Agent 包围了｜设计档案</title><style>
:root{color-scheme:light;--paper:#fcfaf5;--ink:#302d30;--muted:#756d70;--line:#ded7cd;--accent:#745567}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f0ece3;color:var(--ink);font:16px/1.85 system-ui,-apple-system,"Microsoft YaHei",sans-serif}a{color:var(--accent);text-underline-offset:3px}a:focus-visible{outline:3px solid #a38456;outline-offset:4px}header{padding:3rem clamp(1.2rem,5vw,5rem);border-bottom:1px solid var(--line);background:var(--paper)}header p{color:var(--muted);max-width:60em}h1,h2,h3,h4,h5,h6{font-family:"Songti SC","Noto Serif CJK SC",SimSun,serif;line-height:1.5;scroll-margin-top:1.5rem}h1{font-size:clamp(2rem,4vw,3.4rem);margin:.3em 0}h2{font-size:2rem}h3{border-top:1px solid var(--line);padding-top:1.3rem;font-size:1.45rem}.layout{display:grid;grid-template-columns:270px minmax(0,1fr);max-width:1480px;margin:auto}nav{position:sticky;top:0;height:100vh;overflow:auto;padding:2rem 1.5rem;font-size:.88rem}nav ul{list-style:none;padding:0}nav>ul>li{margin:0 0 1.4rem}nav li ul{padding:.5rem 0 0 1rem;font-size:.8rem}nav a{text-decoration:none;display:block;padding:.22rem 0}main{min-width:0;padding:2rem clamp(1rem,4vw,4rem);background:var(--paper)}section{padding-bottom:3rem;margin-bottom:3rem;border-bottom:1px solid var(--line)}p,li,td{overflow-wrap:anywhere}.source{color:var(--muted);font:.78rem/1.6 ui-monospace,monospace;letter-spacing:.05em}code{font: .88em/1.6 ui-monospace,Consolas,monospace;background:#eee9e1;padding:.12em .3em;border-radius:3px}pre{overflow:auto;padding:1.2rem;background:#eee9e1;border:1px solid var(--line);border-radius:6px}pre code{padding:0;white-space:pre}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.91rem}th,td{border:1px solid var(--line);padding:.7rem .85rem;text-align:left;vertical-align:top}th{background:#eee8de}blockquote{margin:1rem 0;padding:.4rem 1.2rem;border-left:3px solid #b49c7d;background:#f3efe7;color:var(--muted)}.image-note{color:var(--muted)}hr{border:0;border-top:1px solid var(--line)}@media(max-width:800px){.layout{display:block}nav{position:static;height:auto;max-height:45vh;border-bottom:1px solid var(--line)}nav li ul{display:none}header{padding:2rem 1.2rem}main{padding:1.5rem 1.2rem}h2{font-size:1.6rem}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{nav{display:none}.layout{display:block}body,header,main{background:white}main{padding:0}pre,table{break-inside:avoid}}
</style></head><body><header><div class="source">TOKEN / AFTERHOURS · v${escapeHTML(version)}</div><h1>完蛋，我被 Agent 包围了</h1><p>设计与实现档案 · 下文按现有 Markdown 原稿生成，不替代测试报告。所有原始 HTML 均转义；图片仅显示说明，外部参考链接不会自动加载。</p></header><div class="layout"><nav aria-label="设计档案目录"><strong>目录</strong><ul>${navigation.join('')}</ul></nav><main>${sections.join('\n')}</main></div></body></html>\n`;
  return { html, sources };
}

export async function build() {
  const pkg = JSON.parse((await readLocal('package.json')).toString('utf8'));
  let html = (await readLocal('index.html')).toString('utf8');
  assert(!html.includes('@@TOK_'), '输入 HTML 不应预含构建占位符');
  const assetTag = '<script id="asset-map">window.AfterhoursAssets = null;</script>';
  assert.equal(html.split(assetTag).length - 1, 1, 'asset-map 初始标签必须恰好出现一次');
  html = html.replace(assetTag, '@@TOK_ASSETS@@');
  const cssTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]).filter((tag) => /(?:^|\s)stylesheet(?:\s|$)/i.test(attr(tag, 'rel') || ''));
  assert.equal(cssTags.length, 1, '必须恰有一个样式表');
  assert.equal(attr(cssTags[0], 'href'), 'src/ui/styles.css');
  html = html.replace(cssTags[0], '@@TOK_STYLE@@');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script\s*>/gi)];
  assert.deepEqual(scripts.map((match) => attr(match[0], 'src')), scriptPaths, '四段脚本必须保持合同顺序');
  scripts.forEach((match, index) => { html = html.replace(match[0], `@@TOK_SCRIPT_${index}@@`); });
  const slots = ['@@TOK_ASSETS@@', '@@TOK_STYLE@@', ...scriptPaths.map((_, index) => `@@TOK_SCRIPT_${index}@@`)];
  slots.forEach((token) => assert.equal(html.split(token).length - 1, 1, `${token} 必须唯一`));
  const css = (await readLocal('src/ui/styles.css')).toString('utf8');
  assertPublishable(css, '样式');
  assert(!/<\/style\b/i.test(css), '样式含内嵌结束标签，不能原文打包');
  html = once(html, '@@TOK_STYLE@@', `<style>\n${css}\n</style>`);
  for (const [index, file] of scriptPaths.entries()) {
    const source = (await readLocal(file)).toString('utf8');
    assertPublishable(source, file);
    assert(!/<\/script\b/i.test(source), `${file} 含内嵌结束标签，不能原文打包`);
    html = once(html, `@@TOK_SCRIPT_${index}@@`, `<script>\n${source}\n</script>`);
  }
  assert(!/<script\b[^>]*\bsrc\s*=/i.test(html), '仍有外部脚本');
  assert(!/<link\b[^>]*\brel\s*=\s*["']?stylesheet/i.test(html), '仍有外部样式表');
  assert(!/<script\b[^>]*\bdefer\b/i.test(html), '仍有 defer');
  assertPublishable(html, '发行页面');
  assert.deepEqual(html.match(/@@TOK_[A-Z0-9_]+@@/g), ['@@TOK_ASSETS@@'], '只能留下唯一资产占位符');
  const actualAssets = (await fs.readdir(path.join(root, 'src/assets'))).filter((file) => file.endsWith('.webp')).sort(order);
  assert.deepEqual(actualAssets, assetNames.map((name) => `${name}.webp`).sort(order), 'WebP 资产须为四张立绘、一张客厅、一张封面、十二张事件 CG 和六张结局 CG');
  const assets = [];
  const assetsMap = {};
  for (const name of assetNames) {
    const bytes = await readLocal(`src/assets/${name}.webp`);
    checkWebp(bytes, `${name}.webp`);
    assets.push({ name: `${name}.webp`, bytes: bytes.length, sha256: sha256(bytes), mime: 'image/webp' });
    assetsMap[name] = `data:image/webp;base64,${bytes.toString('base64')}`;
  }
  const licenseTemplate = /<template id="license-notice">[\s\S]*?<\/template>/g;
  assert.equal([...html.matchAll(licenseTemplate)].length, 1, '必须恰有一份许可模板');
  html = html.replace(licenseTemplate, '@@TOK_LICENSE@@');
  const license = (await readLocal('LICENSE')).toString('utf8');
  const assetLicense = (await readLocal('ASSET-LICENSE.md')).toString('utf8');
  assertPublishable(license, '代码许可'); assertPublishable(assetLicense, '素材许可');
  html = once(html, '@@TOK_LICENSE@@', `<template id="license-notice"><h3>代码许可</h3><pre class="license-text">${escapeHTML(license)}</pre><h3>剧情、素材与品牌边界</h3><pre class="license-text">${escapeHTML(assetLicense)}</pre></template>`);
  const dossier = await designDossier(pkg.version);
  // 所有文本处理已经完成。此后禁止对含 base64 的完整页面进行任何替换。
  const finalHTML = once(html, '@@TOK_ASSETS@@', `<script id="asset-map">window.AfterhoursAssets = ${JSON.stringify(assetsMap)};</script>`);
  assert(!finalHTML.includes('@@TOK_'), '存在剩余占位符');
  const gameBytes = Buffer.from(finalHTML, 'utf8');
  const dossierBytes = Buffer.from(dossier.html, 'utf8');
  const files = [
    { name: 'dist/index.html', data: gameBytes },
    { name: 'outputs/token-afterhours.html', data: gameBytes },
    { name: 'outputs/design-dossier.html', data: dossierBytes }
  ];
  const manifest = {
    version: pkg.version,
    assets,
    files: files.map(({ name, data }) => ({ name, bytes: data.length, sha256: sha256(data), mime: 'text/html' })),
    documents: dossier.sources
  };
  await fs.mkdir(path.join(root, 'dist'), { recursive: true });
  await fs.mkdir(path.join(root, 'outputs'), { recursive: true });
  for (const { name, data } of files) await fs.writeFile(path.join(root, name), data);
  await fs.writeFile(path.join(root, 'outputs/asset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`构建完成：${assets.length} 个资产，单文件 ${gameBytes.length} 字节，设计档案 ${dossier.sources.length} 份原稿。`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((error) => { console.error(`构建失败：${error.code || error.message}`); process.exitCode = 1; });
}
