'use strict';

// 先生成 dist/index.html；依赖在隔离位置时通过 PLAYWRIGHT_MODULE 指定，不写入本机路径。
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { fixedRoutes, runRoute } = require('./balance.cjs');
const core = require('../src/engine/core.js');
const story = require('../src/data/story.js');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'outputs');
const distribution = path.join(root, 'dist/index.html');
const baseURL = pathToFileURL(distribution).href;
const ids = core.ids;
const modes = ['shallow', 'deep', 'greedy'];
const eventKeys = ids.flatMap(id => modes.map(mode => `${id}_${mode}`));
const endingIds = ['hunger', 'household', ...ids];
const endingKeys = endingIds.map(id => `ending_${id}`);
const galleryAll = [...eventKeys, ...endingKeys];
const assetKeys = [...ids, 'room', 'cover', ...eventKeys, ...endingKeys];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const caseFilter = process.env.QA_CASE ? new RegExp(process.env.QA_CASE) : null;
const report = {
  schemaVersion: 2, ok: false, checks: [], browser: null,
  environment: { protocol: 'file:', browserOffline: true, isolatedContext: true, persistentUserProfile: false, physicalDeviceTested: false },
  limitations: ['桌面与手机均为 Chromium 自动化模拟，非实机测试；200% 为实际计算字号放大模拟，不是物理设备系统字号验收。', '不推断真人阅读时长，不评价插图美术质量。'],
  scope: caseFilter ? { type: 'targeted', filter: process.env.QA_CASE } : { type: 'full' },
  consoleErrors: [], networkRequests: [], browserInternalRequests: [], networkFailures: [], screenshots: [], routes: []
};
let browser;
let page;
let routeReads = 0;
let measuredAssets;
let decodedAssets;
let exported;

async function check(name, fn) {
  if (caseFilter && !caseFilter.test(name)) return;
  try {
    const details = await fn();
    report.checks.push({ name, ok: true, ...(details === undefined ? {} : { details }) });
    console.log('通过 ' + name);
  } catch (error) {
    const failure = { name, ok: false, error: error.message, stack: error.stack };
    if (page && !page.isClosed()) {
      try {
        failure.screenshot = `qa-${caseFilter ? 'targeted' : 'full'}-failure-${report.checks.length + 1}.png`;
        await page.screenshot({ path: path.join(output, failure.screenshot), fullPage: true, animations: 'disabled' });
      } catch (captureError) { failure.screenshotError = captureError.message; }
    }
    report.checks.push(failure);
    console.error('失败 ' + name + '：' + error.message);
  }
}
function button(action, suffix = '') {
  const selector = `[data-action="${action}"]${suffix}`;
  const appSelector = ['home', 'help'].includes(action) ? `.header ${selector}` : selector;
  return page.locator(`#game-dialog[open] ${selector}, body:not(:has(#game-dialog[open])) #app ${appSelector}`);
}
async function click(action, suffix = '') {
  if (action === 'next') assert(++routeReads <= 300, '单条路线推进 next 超过 300 次，可能存在阅读死循环');
  await button(action, suffix).click();
}
async function state() { return page.evaluate(() => window.FourNightsUI.getState()); }
async function view() { return page.evaluate(() => window.FourNightsUI.getView()); }
async function snapshot() { return { state: await state(), view: await view() }; }
async function validView() {
  assert.equal(await page.evaluate(() => window.FourNightsUI.validateView(window.FourNightsUI.getState(), window.FourNightsUI.getView())), true);
}
async function dialogOpen() { return page.locator('#game-dialog').evaluate(dialog => dialog.open); }
async function closeDialog() { if (await dialogOpen()) await click('close-dialog'); }
async function frames() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function stable() {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
    await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {})));
  });
  await frames();
}
async function shot(name, gallery = false) {
  assert.equal(await dialogOpen(), gallery, '主界面截图不得被小弹窗遮挡');
  await page.waitForFunction(() => !document.getElementById('toast').classList.contains('visible'));
  await stable();
  const filename = path.join(output, name);
  if (gallery) {
    // 收藏页是唯一有意截取的弹窗；临时展开滚动区，完整呈现十二张事件图与六张结局图缩略图。
    const style = await page.addStyleTag({ content: 'dialog[open]{max-height:none!important;height:auto!important;position:absolute!important;top:16px!important;margin-top:0!important}dialog[open] .modal-body{max-height:none!important;overflow:visible!important}' });
    try { await stable(); await page.locator('#game-dialog').screenshot({ path: filename, animations: 'disabled' }); }
    finally { await style.evaluate(element => element.remove()); }
  } else {
    await page.evaluate(() => scrollTo(0, 0));
    await frames();
    await page.screenshot({ path: filename, fullPage: true, animations: 'disabled' });
  }
  report.screenshots.push({ name, viewport: page.viewportSize(), physicalDeviceTested: false });
}
async function newGame() {
  await closeDialog();
  if (!await button('new-game').isVisible()) await click('home');
  await click('new-game');
  if (await dialogOpen()) await click('confirm-new');
  routeReads = 0;
  assert.deepEqual(await state(), core.createState());
  assert.deepEqual(await view(), { phase: 'intro', cursor: 0, readCount: 0 });
}

async function readScene(phase, expected) {
  const game = await state();
  let index = 0;
  while ((await view()).phase === phase && await button('next').isVisible()) {
    const position = await view();
    assert.equal(position.cursor, index, `${phase} 游标不连续`);
    const actual = await page.locator('#dialogue-text').innerText();
    assert(actual.trim(), `${phase} 出现空白对白`);
    if (expected) {
      assert(index < expected.length, `${phase} 多出未约定对白`);
      assert.equal(actual, expected[index].text, `${phase} 第 ${index + 1} 句不符`);
    }
    await click('next');
    assert.equal((await view()).readCount, position.readCount + 1, '一次点击必须恰好读一句');
    assert.deepEqual(await state(), game, '阅读对白不能提交模式或自动推进夜晚');
    index += 1;
  }
  assert(index > 0, `${phase} 未经过真实 next 按钮`);
  if (expected) assert.equal(index, expected.length, `${phase} 有未读对白被跳过`);
  await validView();
  return index;
}
async function reachSelect() {
  if ((await view()).phase === 'intro') await readScene('intro', story.intro);
  if ((await view()).phase === 'common') {
    const game = await state();
    await readScene('common', [...openingLines(game), ...story.nights[game.night - 1].common, ...unlockLines(game)]);
  }
  assert.equal((await view()).phase, 'select');
  assert.equal((await state()).phase, 'select');
}
// 与 src/ui/app.js openingLines / unlockLines 相同：第二晚起先播前一晚所选角色的次晨反应，再按需补 Codex 重置；
// 解锁片段「那天晚上，走廊」排在当晚公共对白之后，只在解锁后的第一晚出现。
function openingLines(game) {
  const last = game.history.at(-1);
  if (!last || game.night === 1) return [];
  const rows = [...story.openings.after[last.character]];
  if (last.character === 'codex' && last.resetNextNight) rows.push(...story.openings.codexReset);
  return rows;
}
function unlockLines(game) {
  return game.night > 1 && core.unlocked(game) && !core.unlocked({ history: game.history.slice(0, -1) }) ? story.openings.unlock : [];
}
function unseenStatus(id) { return '零还没注意到' + (story.characters[id].gender === '男' ? '他' : '她'); }
async function rosterHidden(expectedHidden) {
  for (const id of ids.filter(id => core.constants.characters[id].hidden)) {
    const control = button('select-person', `[data-id="${id}"]`);
    if (expectedHidden) {
      assert.equal(await control.isDisabled(), true, id + ' 解锁前必须禁用');
      assert((await control.innerText()).includes(unseenStatus(id)), id + ' 解锁前必须显示未注意到');
    } else {
      assert.equal(await control.isEnabled(), true, id + ' 解锁后必须可选');
      assert(!(await control.innerText()).includes(unseenStatus(id)));
    }
  }
}
function visitLines(game, id) {
  const previous = game.history.filter(entry => entry.character === id).at(-1);
  const kind = !previous ? null : previous.mode === 'greedy' && game.night >= previous.night + 2 ? 'afterGreedy'
    : previous.night === game.night - 1 ? 'consecutive' : 'switched';
  return [...(kind ? story.returnLines[id][kind] : []), ...story.routes[id][game.characters[id].visits].lines];
}
async function prepareMode(row, inspect = async () => {}) {
  await reachSelect();
  await inspect('select');
  const before = await state();
  const route = story.routes[row.id][before.characters[row.id].visits];
  assert.equal(await button('select-person', `[data-id="${row.id}"]`).isEnabled(), true);
  await click('select-person', `[data-id="${row.id}"]`);
  assert.deepEqual(await state(), core.select(before, row.id));
  await inspect('visit');
  await readScene('visit', visitLines(before, row.id));
  assert.equal((await view()).phase, 'choice');
  assert.equal(await page.locator('[data-action="choose"]').count(), 2);
  for (const [index, choice] of route.choices.entries()) {
    assert((await button('choose', `[data-index="${index}"]`).innerText()).includes(choice.label));
  }
  await inspect('choice');
  const talking = await state();
  await click('choose', `[data-index="${row.choice}"]`);
  assert.deepEqual(await state(), core.choose(talking, row.choice));
  await readScene('reply', route.choices[row.choice].reply);
  assert.equal((await view()).phase, 'mode');
  const current = await state();
  for (const mode of modes) {
    const offer = core.preview(current, current.selected, mode);
    const control = button('pick-mode', `[data-mode="${mode}"]`);
    assert.equal(await control.isEnabled(), offer.allowed);
    const label = await control.innerText();
    assert(label.includes(`消耗 ${offer.cost} Token`));
    assert(label.includes(`饱食 ${current.energy} → ${offer.energyAfter}`));
    assert(label.includes(`补给 +${offer.feed} · 夜耗 −${offer.drain} · ${story.characters[current.selected].name} 剩 ${offer.tokensAfter}`), mode + ' 模式卡须按预览显示补给、当晚夜耗与对方余额');
    assert.equal(offer.drain, core.drainFor(current.night));
    assert.equal(label.includes(`吃不下 ${offer.wasted}，溢出浪费`), offer.wasted > 0, mode + ' 溢出提示须与预览 wasted 一致');
    assert.equal(label.includes('只顶一半饱'), core.constants.characters[current.selected].nourish < 1);
    if (offer.warning && !offer.fatal && offer.allowed) assert(label.includes(offer.warning));
  }
  await inspect('mode');
}
async function commitMode(mode) {
  const before = await snapshot();
  const offer = core.preview(before.state, before.state.selected, mode);
  assert(offer.allowed, offer.reason);
  await click('pick-mode', `[data-mode="${mode}"]`);
  if (mode === 'greedy' || offer.fatal) {
    assert.equal(await dialogOpen(), true, '危险模式必须再次确认');
    assert.deepEqual(await snapshot(), before, '确认之前不能修改状态或阅读位置');
    await click(offer.fatal ? 'confirm-fatal' : 'confirm-mode');
  }
  assert.equal(await dialogOpen(), false);
  assert.deepEqual(await state(), core.commit(before.state, mode));
  assert.equal((await view()).phase, 'supplement');
  assert.equal((await view()).cursor, 0);
  assert.equal(await button('advance-night').count(), 0, '补给对白尚未读完不能跳到下一晚');
  const settled = (await state()).lastResult;
  assert.equal(await page.locator('.result-note').count(), 1, '补给阶段右栏须显示本晚结算');
  const note = await page.locator('.result-note').textContent();
  assert(note.includes(`用去 ${settled.cost} Token · 吸到 ${settled.feed} · 饱食 ${settled.energyBefore} → ${settled.energyAfter}`), note);
  assert.equal(note.includes(`吃不下 ${settled.wasted}，溢出浪费`), settled.wasted > 0);
  if (await page.locator('.energy-bar i').count()) {
    assert.equal(await page.locator('.energy-bar i').first().evaluate(element => element.style.width), Math.round(settled.energyAfter / core.constants.maxEnergy * 100) + '%', '饱食条按上限 60 计算宽度');
  }
  await validView();
}
async function galleryKeys() {
  await closeDialog();
  await click('open-gallery');
  assert.equal(await page.locator('[data-action="gallery-image"]').count(), galleryAll.length);
  assert.equal(await page.locator('.gallery-grid.is-endings [data-action="gallery-image"]').count(), endingKeys.length, '结局画面须作为独立一行排在事件图之后');
  const keys = await page.locator('.gallery-card.unlocked').evaluateAll(cards => cards.map(card => card.dataset.key).sort());
  await closeDialog();
  return keys;
}
async function visibleCG() {
  const game = await state();
  const key = story.cgMap[game.lastResult.character][game.lastResult.mode];
  const image = page.locator(`.event-art[data-asset="${key}"]`);
  await image.waitFor({ state: 'visible' });
  await image.scrollIntoViewIfNeeded();
  await image.evaluate(image => image.decode());
  assert.equal(await image.evaluate(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), true);
  await frames();
  const collection = await galleryKeys();
  assert(collection.includes(key), `${key} 实际显示并解码后仍未收藏；不接受人物图代示`);
}
async function readResult({ capture = false, inspect = async () => {} } = {}) {
  const resultState = await state();
  const result = resultState.lastResult;
  assert.equal(resultState.phase, 'result');
  assert.equal((await view()).phase, 'supplement');
  if (result.energyAfter > 0) {
    await visibleCG();
    if (capture) await shot('preview-dialogue.png');
    await inspect('supplement');
    const repeated = resultState.history.some(entry => entry.night < result.night && entry.character === result.character && entry.mode === result.mode);
    await readScene('supplement', story[repeated ? 'repeatSupplements' : 'supplements'][result.character][result.mode]);
    assert.equal((await view()).phase, 'morning');
    await readScene('morning', story.morning[result.character][result.mode]);
  } else {
    assert.equal(await page.locator('.event-art').count(), 0, '饥饿片段不能显示正常补给 CG');
    await readScene('supplement');
    assert.equal((await view()).phase, 'morning');
    await readScene('morning');
  }
  assert.deepEqual(await state(), resultState);
  assert.equal(await button('next').count(), 0);
  assert.equal(await button('advance-night').isEnabled(), true);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'page-end', '一晚读完，焦点须落在「合上这一页」上，而不是掉回 main');
  if (result.night === 1) {
    // 键盘：焦点在「合上这一页」上，按 Enter 直接进入下一晚（刚读完的半秒保护之后）。
    await page.waitForTimeout(550);
    await page.keyboard.press('Enter');
  } else await click('advance-night');
  assert.deepEqual(await state(), core.advance(resultState));
  assert.equal((await view()).phase, (await state()).phase === 'ended' ? 'ending' : 'common');
}
// 后记一开始就显示这个结局自己的 CG（饥饿结局也是），实际解码、可见后收进相册的「结局画面」。
async function visibleEndingCG(expected) {
  const key = story.endingCg[expected];
  assert.equal(key, `ending_${expected}`);
  assert.equal((await view()).phase, 'ending');
  const image = page.locator(`.scene-art .event-art[data-asset="${key}"]`);
  await image.waitFor({ state: 'visible' });
  assert.equal(await page.locator('.scene-art .event-art').count(), 1, '后记只显示结局 CG，不再重放补给 CG 或封面');
  await image.scrollIntoViewIfNeeded();
  await image.evaluate(image => image.decode());
  assert.equal(await image.evaluate(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), true);
  await frames();
  const collection = await galleryKeys();
  assert(collection.includes(key), `${key} 实际显示并解码后仍未收进结局画面`);
  await page.evaluate(() => scrollTo(0, 0));
  return key;
}
async function finishEnding(expected) {
  const final = await state();
  assert.equal(final.phase, 'ended');
  assert.equal(final.endingId, expected);
  await visibleEndingCG(expected);
  await readScene('ending', story.endings[expected].lines);
  assert.equal(await page.locator('.ending-title').innerText(), story.endings[expected].title);
  assert.equal((await view()).cursor, story.endings[expected].lines.length);
  assert.equal(await button('next').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'ending-title', '后记读完，焦点须落在结局标题上');
}
async function playRoute(route, expected, { capture = false } = {}) {
  await newGame();
  for (const [index, row] of route.entries()) {
    await prepareMode(row, capture && index === 0 ? async phase => { if (phase === 'select') await shot('preview-game.png'); } : undefined);
    await commitMode(row.mode);
    await readResult({ capture: capture && index === 0 });
  }
  await finishEnding(expected);
  assert.deepEqual(await state(), runRoute(core, route), '按钮路线终态与合法 fixture 不符');
  const details = { ending: expected, nights: (await state()).history.length, nextClicks: routeReads, actualButtons: true };
  report.routes.push(details);
  return details;
}
async function exportCurrent() {
  await closeDialog();
  await click('open-saves');
  const waiting = page.waitForEvent('download');
  await click('export-save');
  const download = await waiting;
  const raw = fs.readFileSync(await download.path(), 'utf8');
  const pack = JSON.parse(raw);
  assert.equal(pack.format, 'token-four-nights-v4');
  assert.equal(pack.version, 4);
  assert.deepEqual(Object.keys(pack).sort(), ['engine', 'format', 'savedAt', 'ui', 'version']);
  assert.deepEqual(core.deserialize(pack.engine), await state());
  assert.deepEqual(pack.ui, await view());
  await closeDialog();
  return raw;
}
async function importFile(raw, name = 'test-save.json', rejected = false) {
  await closeDialog();
  await click('open-saves');
  await page.locator('#import-save').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(raw) });
  await page.waitForFunction(() => {
    const input = document.getElementById('import-save');
    return !document.getElementById('game-dialog').open || (input && input.files.length === 0);
  });
  if (rejected) {
    assert.equal(await dialogOpen(), true);
    assert.match(await page.locator('#toast').innerText(), /没有载入/);
    await closeDialog();
  } else {
    assert.equal(await dialogOpen(), false);
    await validView();
  }
}

function attachMonitoring(context, label) {
  const shortURL = url => url.startsWith('file:') ? 'file:/' + path.basename(new URL(url).pathname) : url.slice(0, 500);
  context.on('request', request => {
    if (/^(?:file|data|blob):/i.test(request.url())) return;
    let frameURL = '';
    try { frameURL = request.frame().url(); } catch (_) { /* 没有 frame 的请求仍按外部请求检查。 */ }
    const internal = /^(?:edge|chrome):\/\//i;
    // Edge 创建原生下载面板时首个导航尚无 frame；其余请求必须来自内部页面。
    // 游戏页发起内部协议请求仍失败；这里不影响任何 JS 错误或失败请求的收集。
    const downloadPanel = !frameURL && request.isNavigationRequest() && request.resourceType() === 'document' && request.url() === 'edge://downloads/hub';
    if (internal.test(request.url()) && (internal.test(frameURL) || downloadPanel)) {
      report.browserInternalRequests.push({ context: label, url: shortURL(request.url()).split('?')[0], frameURL: shortURL(frameURL), type: request.resourceType(), reason: downloadPanel ? 'Edge 原生下载面板导航（frame 尚未创建）' : '浏览器内部页面资源' });
    } else report.networkRequests.push({ context: label, url: shortURL(request.url()), frameURL: shortURL(frameURL), type: request.resourceType() });
  });
  context.on('requestfailed', request => report.networkFailures.push({ context: label, url: shortURL(request.url()), error: request.failure()?.errorText }));
  context.on('page', tab => {
    tab.on('pageerror', error => report.consoleErrors.push({ context: label, type: 'pageerror', message: error.message }));
    tab.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ context: label, type: 'console', message: message.text() }); });
    tab.on('websocket', socket => report.networkRequests.push({ context: label, url: shortURL(socket.url()), type: 'websocket' }));
  });
}
async function createContext(label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1, acceptDownloads: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  attachMonitoring(context, label);
  await context.setOffline(true);
  return context;
}
async function setTextScale(percent) {
  await page.evaluate(percent => {
    document.querySelectorAll('[data-qa-font-original]').forEach(element => {
      const [value, priority] = JSON.parse(element.dataset.qaFontOriginal);
      if (value) element.style.setProperty('font-size', value, priority); else element.style.removeProperty('font-size');
      delete element.dataset.qaFontOriginal;
    });
    if (percent === 100) return;
    // 先快照再赋值，避免父子继承重复乘二；同时覆盖源码中的 px 字号。
    const measured = [...document.querySelectorAll('#app, #app *, #game-dialog, #game-dialog *')].map(element => [element, parseFloat(getComputedStyle(element).fontSize)]);
    measured.forEach(([element, size]) => {
      element.dataset.qaFontOriginal = JSON.stringify([element.style.getPropertyValue('font-size'), element.style.getPropertyPriority('font-size')]);
      element.style.setProperty('font-size', `${size * percent / 100}px`, 'important');
    });
  }, percent);
  await frames();
}
async function layout() {
  return page.evaluate(() => {
    const scope = document.getElementById('game-dialog').open ? document.getElementById('game-dialog') : document.getElementById('app');
    const clippedText = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!node.textContent.trim() || !parent || parent.closest('[aria-hidden="true"], [hidden], script, style')) continue;
      if (!parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden') continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width <= 0 || rect.height <= 0) continue;
        let problem = rect.left < -1 || rect.right > innerWidth + 1;
        for (let ancestor = parent; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          const box = ancestor.getBoundingClientRect();
          if (/^(hidden|clip)$/.test(style.overflowX) && (rect.left < box.left - 1 || rect.right > box.right + 1)) problem = true;
          if (/^(hidden|clip)$/.test(style.overflowY) && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1)) problem = true;
        }
        if (problem) { clippedText.push(node.textContent.trim().slice(0, 70)); break; }
      }
    }
    const smallButtons = [...scope.querySelectorAll('button, .file-button')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.width < 43.9 || rect.height < 43.9);
    }).map(element => ({ action: element.dataset.action || element.tagName, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, clippedText, smallButtons, dialogueFont: parseFloat(getComputedStyle(document.querySelector('.dialogue-text') || scope).fontSize) };
  });
}
async function sceneToggle(capture = false) {
  const before = await snapshot();
  const panels = page.locator('.novel-stage .dialogue, .novel-stage .selection-panel');
  const toggle = button('toggle-ui');
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(await panels.evaluateAll(elements => elements.every(element => !element.inert && getComputedStyle(element).visibility === 'visible')), true);
  for (const key of ['Enter', 'Space']) {
    if (key === 'Enter') await toggle.click(); else { await toggle.focus(); await page.keyboard.press('Space'); }
    assert.deepEqual(await snapshot(), before, '隐藏界面不能推进故事或消耗资源');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await toggle.innerText(), '恢复对白');
    assert.equal(await toggle.isVisible(), true, '恢复按钮必须仍然可见');
    assert.equal(await panels.evaluateAll(elements => elements.every(element => element.inert && element.getAttribute('aria-hidden') === 'true' && getComputedStyle(element).visibility === 'hidden')), true, '隐藏对白和选择必须同时移出键盘访问');
    await toggle.scrollIntoViewIfNeeded();
    assert.equal(await toggle.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), true, '恢复按钮不得被裁切或遮挡');
    if (capture && key === 'Enter') await shot('qa-scene-hidden.png');
    await page.locator('#main-content').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    assert.deepEqual(await snapshot(), before, '纯看画面时非按钮焦点上的推进快捷键也不能跳读');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'toggle-ui', 'Tab 必须能到达恢复按钮');
    await page.keyboard.press(key);
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    assert.equal(await toggle.innerText(), '纯看画面');
    assert.equal(await panels.evaluateAll(elements => elements.every(element => !element.inert && !element.hasAttribute('aria-hidden') && getComputedStyle(element).visibility === 'visible')), true, '两次 toggle 后对白与选择必须恢复');
    assert.deepEqual(await snapshot(), before, '恢复界面不能改变 state/view');
  }
  await validView();
  return { cycles: 2, keyboardRestore: ['Enter', 'Space'], stateAndViewUnchanged: true };
}
async function responsiveScreen(width, percent, phase, filename) {
  await check(`${width}px / ${percent}% 字号 / ${phase} 可读且无横向溢出`, async () => {
    const originalFont = await page.evaluate(() => {
      const text = document.querySelector('.dialogue-text');
      return text ? parseFloat(getComputedStyle(text).fontSize) : null;
    });
    await setTextScale(percent);
    try {
      await stable();
      if (filename || percent === 200) await shot(filename || `qa-${width}-${percent}-${phase}.png`);
      const measured = await layout();
      if (originalFont !== null) assert(Math.abs(measured.dialogueFont - originalFont * percent / 100) < 0.1, '对白字号未按要求实际放大');
      assert(measured.documentWidth <= width + 1 && measured.bodyWidth <= width + 1, JSON.stringify(measured));
      assert.deepEqual(measured.clippedText, [], '文字超出视口或被 overflow 裁剪');
      assert.deepEqual(measured.smallButtons, [], '可见按钮应至少为 44 × 44 CSS px');
      const toggle = await button('toggle-ui').count() ? await sceneToggle() : null;
      return { ...measured, textScalePercent: percent, toggle, physicalDeviceTested: false };
    } finally { await setTextScale(100); }
  });
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  assert(fs.existsSync(distribution), '缺少 dist/index.html，请主代理完成构建与十二张 CG 后再运行浏览器测试；脚本不会启动服务器或自行构建。');
  let chromium;
  try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core')); }
  catch (_) { throw new Error('需要已安装的 playwright-core；请通过 PLAYWRIGHT_MODULE 指向其安装目录。'); }
  // 沿用旧脚本的 channel 启动方式；可显式指定已有隔离浏览器可执行文件。
  const launch = process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : { channel: process.env.BROWSER_CHANNEL || 'msedge' };
  browser = await chromium.launch({ ...launch, headless: true });
  report.browser = { version: browser.version(), engine: 'chromium', selection: launch.channel || '环境变量指定的可执行文件' };
  const context = await createContext('主流程');
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(baseURL);
  await page.waitForFunction(() => Boolean(window.FourNightsUI));

  await check('离线标题页与只读 UI 接口', async () => {
    assert.match(await page.title(), /完蛋，我被 Agent 包围了/);
    assert.equal(await page.locator('.schema-warning').count(), 0);
    assert.equal(await page.locator('.cover-person').count(), 4);
    assert.equal(await button('new-game').isEnabled(), true);
    assert.deepEqual(await page.evaluate(() => Object.keys(window.FourNightsUI).sort()), ['getState', 'getView', 'validateView']);
    assert.equal(await page.evaluate(() => Object.isFrozen(window.FourNightsUI)), true);
    await shot('preview-cover.png');
    return { protocol: new URL(page.url()).protocol, browserOffline: true };
  });
  await check('二十四张内嵌 WebP 均完整解码，封面、十二张事件 CG 与六张结局 CG 不得缺失或冒充人物图', async () => {
    const html = fs.readFileSync(distribution, 'utf8');
    const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(block => /\bid=["']asset-map["']/.test(block[1]));
    assert.equal(blocks.length, 1);
    const assignment = blocks[0][2].trim().match(/^window\.AfterhoursAssets\s*=\s*(\{[\s\S]*\});?$/);
    assert(assignment, '离线文件缺少 JSON 资产映射');
    const map = JSON.parse(assignment[1]);
    assert.deepEqual(Object.keys(map).sort(), [...assetKeys].sort(), '必须包含全部二十四张图，不接受缺图降级');
    const { checkWebp } = await import('../scripts/build.mjs');
    measuredAssets = assetKeys.map(key => {
      assert.match(map[key], /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/);
      const encoded = map[key].slice('data:image/webp;base64,'.length);
      const bytes = Buffer.from(encoded, 'base64');
      assert.equal(bytes.toString('base64'), encoded, `${key} base64 不规范`);
      checkWebp(bytes, key);
      assert(bytes.equals(fs.readFileSync(path.join(root, 'src/assets', `${key}.webp`))), `${key} 内嵌字节与源文件不一致`);
      return { name: `${key}.webp`, bytes: bytes.length, sha256: sha256(bytes) };
    });
    assert.equal(new Set(measuredAssets.map(asset => asset.sha256)).size, assetKeys.length, '封面与 CG 必须为独立图片，不得复制立绘或同一事件图充数');
    const decoded = await page.evaluate(async keys => {
      const actualKeys = Object.keys(window.AfterhoursAssets || {}).sort();
      if (JSON.stringify(actualKeys) !== JSON.stringify([...keys].sort())) throw new Error('浏览器资产键与离线包不一致');
      return Promise.all(keys.map(async key => {
        const image = new Image(); image.src = window.AfterhoursAssets[key];
        await image.decode();
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) throw new Error(key + ' 无法解码');
        return { key, width: image.naturalWidth, height: image.naturalHeight };
      }));
    }, assetKeys);
    assert.equal(decoded.length, assetKeys.length);
    decodedAssets = decoded;
    return { decodedImages: decoded, missingAllowed: false };
  });
  await check('LightAI 封面独立高清 16:9 并保留 HTML 真标题', async () => {
    const cover = decodedAssets?.find(asset => asset.key === 'cover');
    assert(cover, '缺少封面资产');
    assert.equal(cover.width * 9, cover.height * 16, '封面源图必须是 16:9');
    assert(cover.width >= 1600 && cover.height >= 900, '封面精度不足');
    assert.equal(await page.locator('.cover-hero').count(), 1, '封面必须使用独立主视觉');
    assert.match(await page.locator('.cover h1').innerText(), /完蛋[，,]\s*我被 Agent\s*包围了/);
    return { key: cover.key, width: cover.width, height: cover.height, titleRenderedByHTML: true };
  });
  await check('四人立绘真实透明、轮廓存在且精度充足', async () => {
    const portraits = await page.evaluate(async ids => Promise.all(ids.map(async id => {
      const img = new Image(); img.src = window.AfterhoursAssets[id]; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 192;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, 128, 192);
      const data = ctx.getImageData(0, 0, 128, 192).data;
      let transparent = 0, opaque = 0;
      for (let i = 3; i < data.length; i += 4) { if (data[i] < 16) transparent++; if (data[i] > 240) opaque++; }
      return { id, width: img.naturalWidth, height: img.naturalHeight, transparentFraction: transparent / (128 * 192), opaqueFraction: opaque / (128 * 192), corners: [data[3], data[127 * 4 + 3], data[(191 * 128) * 4 + 3], data[data.length - 1]] };
    })), ids);
    for (const portrait of portraits) {
      assert(portrait.width >= 700 && portrait.height >= 1200, portrait.id + ' 立绘精度不足');
      assert(portrait.transparentFraction > 0.12 && portrait.opaqueFraction > 0.12, portrait.id + ' 不是有效的人物透明立绘');
      assert(portrait.corners.every(alpha => alpha < 16), portrait.id + ' 角落残留不透明背景');
    }
    return { portraits };
  });
  await check('十二张事件 CG 与六张结局 CG 均为独立高清 16:9 场景', async () => {
    assert(decodedAssets, '须先执行全部内嵌图完整解码检查');
    const cgs = decodedAssets.filter(asset => galleryAll.includes(asset.key));
    assert.equal(cgs.length, 18);
    assert.deepEqual(cgs.filter(asset => asset.width * 9 !== asset.height * 16), [], '事件 CG 源图必须是 16:9，不能依靠 CSS 拉伸通过');
    assert(cgs.every(asset => asset.width >= 1600 && asset.height >= 900), '事件 CG 必须至少 1600×900，不能把旧小图放大充数');
    return { checkedCGs: 18, aspectRatio: '16:9' };
  });
  await check('可选 manifest 字节数与 SHA-256 对照', async () => {
    const filename = path.join(output, 'asset-manifest.json');
    if (!fs.existsSync(filename)) return { skipped: true, reason: '没有 manifest；全部内嵌图完整性与浏览器解码仍为必测项' };
    assert(measuredAssets?.length === assetKeys.length, '内嵌图测量未完成');
    const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.deepEqual(manifest.assets.map(asset => asset.name).sort(), measuredAssets.map(asset => asset.name).sort());
    for (const measured of measuredAssets) {
      const asset = manifest.assets.find(asset => asset.name === measured.name);
      assert.equal(asset.bytes, measured.bytes, measured.name);
      assert.equal(asset.sha256, measured.sha256, measured.name);
    }
    const file = manifest.files.find(file => file.name === 'dist/index.html');
    assert(file, 'manifest 缺少 dist/index.html');
    const bytes = fs.readFileSync(distribution);
    assert.equal(file.bytes, bytes.length);
    assert.equal(file.sha256, sha256(bytes));
    return { checkedAssets: assetKeys.length, distributionHashMatched: true };
  });
  await check('玩法、成年人物资料、弹窗焦点与离线许可', async () => {
    await click('help');
    const help = await page.locator('#game-dialog').innerText();
    assert.match(help, /饱食上限 60/);
    assert.match(help, /20、25、30、35/);
    assert.match(help, /只顶一半饱/);
    assert.match(help, /全局重置/);
    for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
      await page.keyboard.press(key);
      assert.equal(await page.evaluate(() => document.getElementById('game-dialog').contains(document.activeElement)), true, `${key} 不得让玩法弹窗焦点逃逸`);
    }
    await page.screenshot({ path: path.join(output, 'qa-focus-after.png'), fullPage: true, animations: 'disabled' });
    report.screenshots.push({ name: 'qa-focus-after.png', viewport: page.viewportSize(), physicalDeviceTested: false });
    await page.keyboard.press('Escape');
    assert.equal(await dialogOpen(), false);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'help', '关闭玩法应回到原触发按钮');
    for (const id of ids) {
      const badge = page.locator(`.cover-person[data-id="${id}"] .cover-person-name strong`);
      assert.equal(await badge.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('button')?.dataset.id;
      }), id, `${id} 的姓名命中区域不得被相邻人物透明按钮框遮挡`);
      await badge.click();
      assert.equal(await page.locator('#dialog-title').innerText(), story.characters[id].name);
      assert((await page.locator('#game-dialog').innerText()).includes(`${story.characters[id].age} 岁`));
      await closeDialog();
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.id), id, '关闭人物资料应恢复对应人物焦点');
    }
    await click('licenses');
    const license = await page.locator('#game-dialog').innerText();
    assert(license.includes('Permission is hereby granted'));
    assert(license.includes('THE SOFTWARE IS PROVIDED'));
    for (const name of ['LICENSE', 'ASSET-LICENSE.md']) {
      const original = fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n?/g, '\n').trim();
      assert((await page.locator('#game-dialog').textContent()).replace(/\r\n?/g, '\n').includes(original), name + ' 原文未完整保留');
    }
    await closeDialog();
  });
  await check('纯看画面：桌面各阶段 state/view 不变、恢复可见且 Enter/Space 可操作', async () => {
    await newGame();
    const phases = [];
    await prepareMode({ id: 'claude', choice: 0 }, async phase => {
      phases.push({ phase, ...await sceneToggle(phase === 'visit') });
    });
    await commitMode('deep');
    await visibleCG();
    phases.push({ phase: 'supplement', ...await sceneToggle() });
    return { phases };
  });
  await check('多控件弹窗循环焦点、重绘后返回及单次键盘推进', async () => {
    await newGame();
    await click('open-saves');
    const close = button('close-dialog');
    await close.focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'import-save');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'close-dialog');
    await click('save-slot', '[data-slot="3"]');
    if (await button('confirm-save').count()) await click('confirm-save', '[data-slot="3"]');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'open-saves', '存档弹窗重绘后仍须恢复触发焦点');
    const before = await snapshot();
    await button('next').focus();
    await page.keyboard.press('Space');
    assert.deepEqual(await state(), before.state);
    assert.equal((await view()).readCount, before.view.readCount + 1, 'Space 在按钮上只能原生点击推进一次');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'next', '对白重绘应恢复下一句按钮焦点');
    return { tabBoundaries: 2, modalRerender: true, nextKeyPresses: 1 };
  });
  await check('四晚普通结局及末晚补给、晨间、后记均由实际按钮完整读完', async () => {
    const details = await playRoute(fixedRoutes.household, 'household', { capture: true });
    await shot('preview-ending.png');
    return details;
  });
  for (const id of ids) {
    await check(`${story.characters[id].name} 四晚固定路线与重复补给`, () => playRoute(fixedRoutes[id], id));
  }
  await check('贪心取消不改状态；Codex 首次清零全局重置、再次清零休息一晚、Claude 清零后新室友出现', async () => {
    await newGame();
    await reachSelect();
    await rosterHidden(true);
    await prepareMode({ id: 'codex', choice: 0 });
    assert.match(await button('pick-mode', '[data-mode="greedy"]').innerText(), /消耗 90 Token/);
    const before = await snapshot();
    await click('pick-mode', '[data-mode="greedy"]');
    assert.equal(await dialogOpen(), true);
    const confirmText = await page.locator('#game-dialog').innerText();
    assert.match(confirmText, /全局重置/);
    assert.match(confirmText, /吸到 90/);
    assert.match(confirmText, /变为 60/);
    assert.match(confirmText, /吃不下的 38 会溢出浪费/);
    assert.deepEqual(await snapshot(), before);
    await click('cancel-fatal');
    assert.deepEqual(await snapshot(), before);
    await commitMode('greedy');
    assert.equal((await state()).characters.codex.tokens, 0);
    assert.equal((await state()).characters.codex.blockedNight, 0);
    assert.equal((await state()).lastResult.resetNextNight, true);
    await readResult();
    // 第二晚开场含 Codex 全局重置片段；她回满且可选，不休息。
    assert.deepEqual(openingLines(await state()).slice(-story.openings.codexReset.length), story.openings.codexReset);
    await reachSelect();
    assert.equal((await state()).night, 2);
    assert.equal((await state()).characters.codex.tokens, core.constants.characters.codex.caps[1]);
    assert.equal(await button('select-person', '[data-id="codex"]').isEnabled(), true);
    assert.doesNotMatch(await button('select-person', '[data-id="codex"]').innerText(), /本晚休息/);
    await rosterHidden(true);
    await prepareMode({ id: 'codex', choice: 1 }); await commitMode('greedy');
    assert.equal((await state()).lastResult.blockedNextNight, true);
    assert.equal((await state()).characters.codex.blockedNight, 3);
    await readResult(); await reachSelect();
    assert.equal((await state()).night, 3);
    assert.equal(await button('select-person', '[data-id="codex"]').isDisabled(), true);
    assert.match(await button('select-person', '[data-id="codex"]').innerText(), /本晚休息.*下一晚恢复/);
    await rosterHidden(true);
    await prepareMode({ id: 'claude', choice: 1 }); await commitMode('greedy'); await readResult();
    // Codex 与 Claude 都被榨干过，第四晚公共对白之后播放解锁片段，新室友可选。
    assert.deepEqual(unlockLines(await state()), story.openings.unlock);
    assert.deepEqual(openingLines(await state()), story.openings.after.claude, '解锁片段不排在次晨反应里');
    await reachSelect();
    assert.equal((await state()).night, 4);
    await rosterHidden(false);
    assert.equal((await state()).characters.codex.tokens, core.constants.characters.codex.caps[3]);
    assert.equal(await button('select-person', '[data-id="codex"]').isEnabled(), true);
    assert.equal(await button('select-person', '[data-id="claude"]').isDisabled(), true);
    await prepareMode({ id: 'codex', choice: 0 }); await commitMode('deep'); await readResult();
    await finishEnding('codex');
    return { resetNight: 2, blockedNight: 3, recoveredNight: 4, unlockedNight: 4, nextClicks: routeReads };
  });
  await check('三次浅尝预警、取消危险与 Escape 均不改状态，明确确认后才进入饥饿结局', async () => {
    await newGame();
    for (const [index, row] of fixedRoutes.hunger.slice(0, 2).entries()) {
      await prepareMode(row);
      if (index === 1) assert.match(await button('pick-mode', '[data-mode="shallow"]').innerText(), /偏低|不高于 10/);
      await commitMode(row.mode);
      assert.equal((await state()).energy, [18, 3][index]);
      await readResult();
    }
    await prepareMode(fixedRoutes.hunger[2]);
    assert.match(await button('pick-mode', '[data-mode="shallow"]').innerText(), /饥饿结局.*再次确认/);
    const before = await snapshot();
    const collected = await galleryKeys();
    for (const cancel of ['cancel-fatal', 'Escape']) {
      await click('pick-mode', '[data-mode="shallow"]');
      assert.equal(await dialogOpen(), true);
      assert.deepEqual(await snapshot(), before);
      assert.match(await page.locator('#game-dialog').innerText(), /归零/);
      if (cancel === 'Escape') await page.keyboard.press('Escape'); else await click(cancel);
      assert.equal(await dialogOpen(), false);
      assert.deepEqual(await snapshot(), before);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.mode), 'shallow');
    }
    await commitMode('shallow');
    assert.equal((await state()).energy, 0);
    assert.equal((await state()).endingId, null, '确认后仍须先读虚弱片段，不能直接跳后记');
    await readResult();
    await finishEnding('hunger');
    assert.deepEqual(await state(), runRoute(core, fixedRoutes.hunger));
    assert.deepEqual((await galleryKeys()).filter(key => eventKeys.includes(key)), collected.filter(key => eventKeys.includes(key)), '死亡片段不能增加正常补给收藏');
    assert((await galleryKeys()).includes('ending_hunger'), '饥饿结局 CG 须在后记显示后收进相册');
    return { nights: 3, ending: 'hunger', nextClicks: routeReads };
  });
  await check('真实文件导入：坏档、派生状态篡改、phase/cursor/readCount 篡改与旧 v1/v2/v3 全部拒绝且不改当前局', async () => {
    await newGame(); await reachSelect();
    await click('select-person', '[data-id="claude"]'); await click('next');
    const before = await snapshot();
    exported = await exportCurrent();
    const pack = JSON.parse(exported);
    const cases = [{ name: 'broken.json', raw: '{' }, { name: 'oversized.json', raw: ' '.repeat(128 * 1024 + 1) }];
    for (const [field, value] of [['phase', 'ending'], ['cursor', pack.ui.cursor + 1], ['readCount', pack.ui.readCount + 1]]) {
      const changed = clone(pack); changed.ui[field] = value;
      const rejected = await page.evaluate(({ game, candidate }) => {
        try { window.FourNightsUI.validateView(game, candidate); return false; } catch (_) { return true; }
      }, { game: before.state, candidate: changed.ui });
      assert.equal(rejected, true, field + ' 篡改应被只读验证接口拒绝');
      cases.push({ name: `tampered-${field}.json`, raw: JSON.stringify(changed) });
    }
    const skipped = clone(pack); skipped.ui.phase = 'choice'; skipped.ui.cursor = 0;
    cases.push({ name: 'skip-unread.json', raw: JSON.stringify(skipped) });
    const derived = clone(pack); const engine = JSON.parse(derived.engine); engine.state.energy += 1; derived.engine = JSON.stringify(engine);
    cases.push({ name: 'tampered-engine.json', raw: JSON.stringify(derived) });
    const old = clone(pack); old.version = 1; old.format = 'token-afterhours';
    cases.push({ name: 'old-v1.json', raw: JSON.stringify(old) });
    const oldV2 = clone(pack); oldV2.version = 2; oldV2.format = 'token-four-nights-v2';
    cases.push({ name: 'old-v2-pack.json', raw: JSON.stringify(oldV2) });
    const oldEngine = clone(pack); const v2 = JSON.parse(oldEngine.engine); v2.format = 'four-nights-v2'; v2.state.version = 2; oldEngine.engine = JSON.stringify(v2);
    cases.push({ name: 'old-v2-engine.json', raw: JSON.stringify(oldEngine) });
    const oldV3 = clone(pack); oldV3.version = 3; oldV3.format = 'token-four-nights-v3';
    cases.push({ name: 'old-v3-pack.json', raw: JSON.stringify(oldV3) });
    const oldV3Engine = clone(pack); const v3 = JSON.parse(oldV3Engine.engine); v3.format = 'four-nights-v3'; v3.state.version = 3; oldV3Engine.engine = JSON.stringify(v3);
    cases.push({ name: 'old-v3-engine.json', raw: JSON.stringify(oldV3Engine) });
    for (const entry of cases) {
      await importFile(entry.raw, entry.name, true);
      assert.deepEqual(await snapshot(), before, entry.name + ' 失败导入修改了当前局');
    }
    await click('next'); assert.notDeepEqual(await view(), before.view);
    await importFile(exported);
    assert.deepEqual(await snapshot(), before, '有效 JSON 必须恢复真实阅读位置');
    return { rejectedFiles: cases.map(entry => entry.name), validRoundTrip: true };
  });
  await check('手动档、自动档刷新与阅读游标 roundtrip', async () => {
    assert(exported, '需要上一检查通过真实导出获得的存档');
    await importFile(exported);
    const saved = await snapshot();
    await click('open-saves'); await click('save-slot', '[data-slot="1"]');
    if (await button('confirm-save').count()) await click('confirm-save', '[data-slot="1"]');
    await closeDialog(); await click('next');
    const automatic = await snapshot();
    assert.notDeepEqual(automatic.view, saved.view);
    await page.reload(); await click('continue-auto');
    assert.deepEqual(await snapshot(), automatic, '刷新丢失自动保存的游标或状态');
    await click('open-saves'); await click('load-slot', '[data-slot="1"]');
    // 还有没读完的一局时，读手动档先要确认；取消不改当前进度。
    assert.equal(await button('confirm-load', '[data-slot="1"]').count(), 1, '读手动档须先确认替换当前进度');
    await click('open-saves');
    assert.deepEqual(await snapshot(), automatic, '取消读取不能改动当前进度');
    await click('load-slot', '[data-slot="1"]'); await click('confirm-load', '[data-slot="1"]');
    assert.deepEqual(await snapshot(), saved, '手动档未恢复原阅读边界');
    await page.reload(); await click('continue-auto');
    assert.deepEqual(await snapshot(), saved, '读手动档后刷新未保留状态');
    await validView();
  });
  for (const id of ids) {
    await check(`${story.characters[id].name} 事件图经真实阅读解锁`, async () => {
      // Codex/Claude 同一路线覆盖三种模式；Cursor/WorkBuddy 需先榨干两人解锁，其 deep 事件图已由固定路线收藏。
      const route = core.constants.characters[id].hidden
        ? [{ id: 'codex', choice: 1, mode: 'greedy' }, { id: 'claude', choice: 1, mode: 'greedy' }, { id, choice: 0, mode: 'shallow' }, { id, choice: 1, mode: 'greedy' }]
        : [{ id, choice: 1, mode: 'shallow' }, { id, choice: 0, mode: 'deep' }, { id: ids.find(other => other !== id && !core.constants.characters[other].hidden), choice: 1, mode: 'deep' }, { id, choice: 1, mode: 'greedy' }];
      return playRoute(route, id);
    });
  }
  await check('十二事件 CG 与六结局 CG 收藏、新局、读档和刷新均保留', async () => {
    assert.deepEqual(await galleryKeys(), [...galleryAll].sort(), '所有路线读完后须收齐十二张事件图和六张结局图');
    await click('open-gallery');
    assert.match(await page.locator('#game-dialog .modal-body > p').first().innerText(), /事件 12 \/ 12 · 结局 6 \/ 6/);
    await closeDialog();
    await click('open-gallery'); await shot('cg-gallery.png', true);
    await click('gallery-image', '[data-key="claude_deep"]');
    await stable();
    assert.equal(await page.locator('.gallery-full[data-asset="claude_deep"]').count(), 1);
    assert.match(await page.locator('.gallery-caption').innerText(), /补给场景的事件图/);
    await click('open-gallery');
    await click('gallery-image', '[data-key="ending_household"]');
    await stable();
    assert.equal(await page.locator('.gallery-full[data-asset="ending_household"]').count(), 1);
    assert.match(await page.locator('.gallery-caption').innerText(), new RegExp(story.endings.household.title));
    await closeDialog(); await newGame();
    assert.deepEqual(await galleryKeys(), [...galleryAll].sort());
    await page.reload(); await click('continue-auto');
    assert.deepEqual(await galleryKeys(), [...galleryAll].sort());
    assert(exported, '需要真实导出的存档');
    await importFile(exported);
    assert.deepEqual(await galleryKeys(), [...galleryAll].sort());
    return { collected: { events: 12, endings: 6 }, physicalDeviceTested: false };
  });

  for (const width of [390, 320]) {
    for (const percent of [100, 200]) {
      await check(`${width}px / ${percent}% 响应式实际按钮流程`, async () => {
        await page.setViewportSize({ width, height: 844 });
        await closeDialog(); await click('home');
        await responsiveScreen(width, percent, '封面', width === 390 && percent === 100 ? 'preview-mobile-cover.png' : undefined);
        await newGame();
        await prepareMode({ id: 'claude', choice: 0 }, phase => responsiveScreen(width, percent, phase));
        await commitMode('deep');
        await visibleCG();
        // 使用本段最长对白检查字号放大，防止只选短句通过。
        const longest = story.supplements.claude.deep.reduce((best, line, index, all) => Array.from(line.text).length > Array.from(all[best].text).length ? index : best, 0);
        for (let index = 0; index < longest; index += 1) await click('next');
        assert.equal((await view()).phase, 'supplement');
        assert.equal(await page.locator('#dialogue-text').innerText(), story.supplements.claude.deep[longest].text);
        await responsiveScreen(width, percent, '最长补给对白', width === 390 && percent === 100 ? 'preview-mobile.png' : undefined);
        await validView();
        return { viewport: { width, height: 844 }, textScalePercent: percent, nextClicks: routeReads, physicalDeviceTested: false };
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 980 });
  await check('禁用本地存储时仍可离线开始并导出合法当前局', async () => {
    const restricted = await createContext('禁用存储');
    await restricted.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('测试禁用本地存储', 'SecurityError'); }; });
    const previous = page;
    try {
      page = await restricted.newPage(); page.setDefaultTimeout(10000);
      await page.goto(baseURL); await page.waitForFunction(() => Boolean(window.FourNightsUI));
      await newGame(); await reachSelect();
      assert.equal(await page.locator('.storage-warning').count(), 1);
      const raw = await exportCurrent();
      assert.deepEqual(core.deserialize(JSON.parse(raw).engine), await state());
    } finally { page = previous; await restricted.close(); }
  });
  await check('所有上下文离线运行，外部请求零次且控制台无错误', async () => {
    assert.deepEqual(report.networkRequests, [], '即使离线拦截成功，尝试出网也算失败');
    assert.deepEqual(report.networkFailures, []);
    assert.deepEqual(report.consoleErrors, []);
    return { externalRequests: 0, browserInternalRequests: report.browserInternalRequests.length, consoleErrors: 0, browserOffline: true, serverUsed: false, physicalDeviceTested: false };
  });
  await check('七张要求的截图均已生成', async () => {
    const required = ['preview-cover.png', 'preview-game.png', 'preview-dialogue.png', 'preview-ending.png', 'preview-mobile.png', 'preview-mobile-cover.png', 'cg-gallery.png'];
    for (const name of required) {
      assert(report.screenshots.some(screenshot => screenshot.name === name), name + ' 本次未生成');
      assert(fs.statSync(path.join(output, name)).size > 0);
    }
    return { screenshots: required, physicalDeviceTested: false };
  });
  await context.close();
}

main().catch(error => {
  report.fatal = error.message;
  report.checks.push({ name: '浏览器测试基础设施', ok: false, error: error.message });
  console.error(error.message);
}).finally(async () => {
  if (browser) {
    try { await browser.close(); }
    catch (error) { report.checks.push({ name: '关闭隔离浏览器', ok: false, error: error.message }); }
  }
  report.testedFiles = ['dist/index.html', 'src/data/story.js', 'src/engine/core.js', 'src/ui/app.js', 'src/ui/styles.css', 'tests/balance.cjs', 'tests/browser.cjs'].filter(name => fs.existsSync(path.join(root, name))).map(name => ({ name, sha256: sha256(fs.readFileSync(path.join(root, name))) }));
  report.ok = !report.fatal && report.checks.length > 0 && report.checks.every(item => item.ok) && report.consoleErrors.length === 0 && report.networkRequests.length === 0 && report.networkFailures.length === 0;
  fs.mkdirSync(output, { recursive: true });
  report.summary = { passed: report.checks.filter(item => item.ok).length, failed: report.checks.filter(item => !item.ok).length, total: report.checks.length };
  fs.writeFileSync(path.join(output, caseFilter ? 'browser-qa-targeted.json' : 'browser-qa.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`浏览器 QA（${caseFilter ? '定向子集，非完整回归' : '完整回归'}）：${report.summary.passed}/${report.summary.total}；手机与大字均为模拟，非实机。`);
  if (!report.ok) process.exitCode = 1;
});
