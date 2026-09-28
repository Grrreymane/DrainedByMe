import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { root, assetNames, scriptPaths, sha256, checkWebp, readLocal, assertPublishable } from './build.mjs';

const require = createRequire(import.meta.url);
const visibleKeys = new Set(['text', 'name', 'title', 'subtitle', 'label', 'hint', 'note', 'gender', 'animal', 'role', 'tagline', 'bio', 'voice', 'taskTitle', 'taskDescription']);
const banned = [/不是[^。！？\n]*?而是/u, /仿佛/u, /总而言之/u, /令人窒息的张力/u, /不禁/u, /忍不住/u];

export function playableTexts(value, location = 'story', found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'sources' || key === 'sourceIds' || key === 'effect') continue;
    const pointer = `${location}.${key}`;
    if (typeof child === 'string' && visibleKeys.has(key)) found.push({ path: pointer, text: child });
    else if (child && typeof child === 'object') playableTexts(child, pointer, found);
  }
  return found;
}

function strictBase64(uri, label) {
  assert.equal(typeof uri, 'string', `${label} data URI 必须是字符串`);
  const prefix = 'data:image/webp;base64,';
  assert(uri.startsWith(prefix), `${label} MIME 不正确`);
  const encoded = uri.slice(prefix.length);
  assert(encoded.length > 0 && encoded.length % 4 === 0, `${label} base64 长度不规范`);
  assert(/^[A-Za-z0-9+/]*={0,2}$/.test(encoded), `${label} base64 字符或填充错误`);
  const bytes = Buffer.from(encoded, 'base64');
  assert(bytes.toString('base64') === encoded, `${label} base64 未使用规范填充位`);
  return bytes;
}

export function resourceChecks(html, scripts, css) {
  // 只检查加载资源与网络调用，不把来源面板的普通 HTTPS 引用链接误报为 CDN。
  const remoteAttr = /\b(?:src|srcset|poster|data)\s*=\s*["']\s*(?:https?:)?\/\//i;
  assert(!remoteAttr.test(html), '存在外网资源属性');
  const resourceTags = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<(?:link|img|audio|video|source|iframe|object|embed)\b[^>]*>/gi)].map((match) => match[0]).filter((tag) => !/^<script\b/i.test(tag));
  for (const tag of resourceTags.filter((tag) => !/^<link\b/i.test(tag))) {
    const target = tag.match(/\b(?:src|poster|data)\s*=\s*["']([^"']*)["']/i)?.[1];
    assert(!target || target.startsWith('data:'), '单文件仍有非内嵌媒体资源');
  }
  for (const tag of resourceTags.filter((tag) => /^<link\b/i.test(tag))) {
    const href = tag.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1];
    assert(!href || href.startsWith('data:'), '单文件仍有非内嵌 link 资源');
  }
  assert(!/@import\b/i.test(css), '样式不得使用 @import');
  // Quoted SVG data URIs may contain spaces, opposite quotes and nested url(#filter).
  // Consume the complete outer URL so inner SVG paint references are not treated as requests.
  for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) {
    const target = (match[1] ?? match[2] ?? match[3]).trim();
    assert(target.startsWith('data:') || target.startsWith('#'), '样式含非内嵌 URL');
  }
  for (const source of scripts) {
    assert(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\s*\(|\bimport\s*\(/.test(source), '脚本出现运行期网络入口，需人工审查');
    assert(!/\.(?:src|href)\s*=\s*["'`](?:https?:)?\/\//i.test(source), '脚本动态加载外部资源');
  }
}

export async function verify() {
  const report = { schemaVersion: 1, ok: false, checks: [], assets: [], files: [], content: null, limitations: ['静态检查不等于浏览器 DOM、按钮交互或图像解码验收；WebP 检查涵盖字节、SHA-256、RIFF 与分块边界。'] };
  const check = async (name, action) => {
    try { const details = await action(); report.checks.push({ name, ok: true, ...(details === undefined ? {} : { details }) }); }
    catch (error) { report.checks.push({ name, ok: false, error: String(error.message).split('\n')[0], ...(error.code ? { code: error.code } : {}) }); }
  };
  let manifest;
  let html;
  let blocks;
  let map;
  await check('清单与发行文件', async () => {
    manifest = JSON.parse((await readLocal('outputs/asset-manifest.json')).toString('utf8'));
    const expected = ['dist/index.html', 'outputs/token-afterhours.html', 'outputs/design-dossier.html'];
    assert.deepEqual(manifest.files.map((file) => file.name), expected, '文件清单不完整');
    const pkg = JSON.parse((await readLocal('package.json')).toString('utf8'));
    assert.equal(manifest.version, pkg.version, '版本不一致');
    for (const file of manifest.files) {
      const bytes = await readLocal(file.name);
      const measured = { name: file.name, bytes: bytes.length, sha256: sha256(bytes), mime: 'text/html' };
      assert.deepEqual(measured, file, `${file.name} 与清单不一致`);
      report.files.push(measured);
    }
    const distribution = await readLocal('dist/index.html');
    const output = await readLocal('outputs/token-afterhours.html');
    assert(distribution.equals(output), '两个游戏单文件字节不相同');
    html = output.toString('utf8');
    return { identicalGameFiles: true, files: report.files.length };
  });
  await check('唯一资产映射', async () => {
    assert(html, '发行页面未读取');
    blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
    assert.equal(blocks.length, scriptPaths.length + 1, '必须有资产映射及全部原文脚本');
    const maps = blocks.filter((block) => /\bid\s*=\s*["']asset-map["']/i.test(block[1]));
    assert.equal(maps.length, 1, 'asset-map 必须唯一');
    const match = maps[0][2].match(/^window\.AfterhoursAssets = (\{[\s\S]*\});$/);
    assert(match, 'asset-map 不是预期 JSON 赋值');
    map = JSON.parse(match[1]);
    assert.deepEqual(Object.keys(map), assetNames, '映射必须包含全部角色、客厅、封面和十二张事件 CG');
    assert.equal((html.match(/data:image\/webp;base64,/g) || []).length, assetNames.length, 'WebP data URI 数量须与资产合同一致');
    assert(!html.includes('@@TOK_'), '仍有占位符');
    assert(!/<script\b[^>]*\b(?:src\s*=|defer\b)/i.test(html), '仍有 script src 或 defer');
    assert(!/<link\b[^>]*\brel\s*=\s*["']?stylesheet/i.test(html), '仍有样式表 link');
  });
  for (const name of assetNames) {
    await check(`资产 ${name}`, async () => {
      assert(map && manifest, '资产映射或清单不可用');
      assert.deepEqual(manifest.assets.map((entry) => entry.name), assetNames.map((id) => `${id}.webp`), '资产清单不完整');
      const decoded = strictBase64(map[name], name);
      const source = await readLocal(`src/assets/${name}.webp`);
      assert(decoded.equals(source), `${name} 内嵌字节与源不一致`);
      const measured = { name: `${name}.webp`, bytes: decoded.length, sha256: sha256(decoded), mime: 'image/webp' };
      assert.deepEqual(measured, manifest.assets.find((entry) => entry.name === measured.name), `${name} 清单不符`);
      const riff = checkWebp(decoded, name);
      report.assets.push({ ...measured, sourceSha256: sha256(source), canonicalBase64: true, ...riff });
    });
  }
  await check('脚本原文、语法与基本按钮', async () => {
    assert(blocks?.length === scriptPaths.length + 1, '脚本块不完整');
    const sources = [];
    for (const [index, filename] of scriptPaths.entries()) {
      const source = (await readLocal(filename)).toString('utf8');
      assert.equal(blocks[index + 1][2], `\n${source}\n`, `${filename} 未保持原文或顺序`);
      new vm.Script(source, { filename });
      sources.push(source);
    }
    new vm.Script(blocks[0][2], { filename: 'asset-map' });
    assert(/\bid=["']app["']/.test(html), '缺少 app 容器');
    assert(/\bid=["']game-dialog["']/.test(html), '缺少 dialog 容器');
    assert(/AfterhoursAssets/.test(sources[scriptPaths.indexOf('src/ui/app.js')]), 'app 未读取资产映射');
    const buttonTemplates = (sources[scriptPaths.indexOf('src/ui/app.js')].match(/<button\b|createElement\(\s*["']button["']/gi) || []).length;
    assert(buttonTemplates > 0, 'app 中没有按钮模板');
    const css = (await readLocal('src/ui/styles.css')).toString('utf8');
    const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)];
    assert.equal(styles.length, 1, '必须恰好一段样式');
    assert.equal(styles[0][1], `\n${css}\n`, '样式没有原文内嵌');
    resourceChecks(html, sources, css);
    assertPublishable(html, '发行页面');
    return { scriptCount: blocks.length, originalSourcesPreserved: true, buttonTemplates, browserDOMTested: false };
  });
  await check('离线文件保留完整代码许可与素材边界', async () => {
    assert(html, '发行页面未读取');
    const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const template = html.match(/<template id="license-notice">([\s\S]*?)<\/template>/)?.[1];
    assert(template, '许可模板缺失');
    for (const file of ['LICENSE', 'ASSET-LICENSE.md']) assert(template.includes(escape((await readLocal(file)).toString('utf8'))), file + ' 原文许可未完整保留');
    return { completeLicenseTexts: 2 };
  });
  await check('设计档案与原稿', async () => {
    assert(manifest && Array.isArray(manifest.documents), '缺少档案原稿清单');
    for (const required of ['docs/design/GDD.md', 'docs/design/NARRATIVE.md', 'docs/RESEARCH.md', 'docs/ARCHITECTURE.md']) {
      assert(manifest.documents.some((doc) => doc.name === required), `档案未收录 ${required}`);
    }
    for (const doc of manifest.documents) {
      const bytes = await readLocal(doc.name);
      assert.equal(bytes.length, doc.bytes, `${doc.name} 已变化，请重新构建`);
      assert.equal(sha256(bytes), doc.sha256, `${doc.name} 已变化，请重新构建`);
    }
    const dossier = (await readLocal('outputs/design-dossier.html')).toString('utf8');
    assert(!/<script\b|<img\b|<iframe\b/i.test(dossier), '档案不应执行脚本或加载图片');
    assert(/<nav\b/.test(dossier) && /<table\b/.test(dossier) && /<pre\b/.test(dossier), '档案缺少目录、表格或代码块');
    assert(dossier.includes("default-src 'none'"), '档案缺少安全策略');
    assertPublishable(dossier, '设计档案');
    return { documents: manifest.documents.length, rawHTMLPolicy: '全部转义', remoteImages: 0 };
  });
  await check('可玩剧情禁用词', async () => {
    const storyFile = path.join(root, 'src/data/story.js');
    delete require.cache[require.resolve(storyFile)];
    const texts = playableTexts(require(storyFile));
    assert(texts.length > 0, '没有读取到可玩剧情文本');
    const violations = texts.flatMap(({ path: pointer, text }) => banned.filter((pattern) => pattern.test(text)).map((pattern) => ({ path: pointer, pattern: pattern.source })));
    report.content = { scope: '仅 story 中可显示的文本字段；不扫描文档、来源引用、JS 注释或规则标识符', textFields: texts.length, characters: texts.reduce((sum, item) => sum + Array.from(item.text).length, 0), violations };
    assert.equal(violations.length, 0, '可玩剧情含禁用词，位置见 content.violations');
  });
  report.ok = report.checks.every((item) => item.ok);
  await fs.mkdir(path.join(root, 'outputs'), { recursive: true });
  await fs.writeFile(path.join(root, 'outputs/verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`验证${report.ok ? '通过' : '失败'}：${report.checks.filter((item) => item.ok).length}/${report.checks.length}，详见 outputs/verification.json。`);
  for (const item of report.checks.filter((check) => !check.ok)) console.error(`${item.name}：${item.error}`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verify().then((report) => { if (!report.ok) process.exitCode = 1; }).catch((error) => { console.error(`验证失败：${error.code || error.message}`); process.exitCode = 1; });
}
