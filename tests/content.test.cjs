'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const story = require('../src/data/story.js');
const core = require('../src/engine/core.js');
const balance = require('./balance.cjs');
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/design/contracts.json'), 'utf8'));
const ids = contract.characterIds;
const modes = ['shallow', 'deep', 'greedy'];
const endingIds = ['hunger', 'household', ...ids];
// 当前 balance 合同以 household 命名演示路线；不把历史十二轮样本冒充四晚样本。
const demoRoute = balance.demoRoute ?? balance.fixedRoutes.household;
const length = (value) => Array.from(value).length;
const speakers = new Set(['narrator', 'player', ...ids]);

function text(value, location, maximum = 400) {
  assert.equal(typeof value, 'string', `${location} 必须为字符串`);
  assert(value.trim().length > 0, `${location} 不可为空`);
  assert(length(value) <= maximum, `${location} 超过 ${maximum} 个 Unicode 字符`);
}

function keys(value, expected, location) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${location} 必须为对象`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${location} 字段不符合四晚合同`);
}

function lines(value, location) {
  assert(Array.isArray(value) && value.length > 0, `${location} 必须是非空对白数组`);
  value.forEach((line, index) => {
    keys(line, ['speaker', 'text'], `${location}.${index}`);
    assert(speakers.has(line.speaker), `${location}.${index} 发言人无效`);
    text(line.text, `${location}.${index}.text`);
  });
}

function allLineTexts(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (typeof value.text === 'string') found.push(value.text);
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'sources' && child && typeof child === 'object') allLineTexts(child, found);
  }
  return found;
}

// 与 src/ui/app.js openingLines / unlockLines 相同：第二晚起先播前一晚所选角色的次晨反应，再按需补 Codex 重置；
// 解锁片段排在当晚公共对白之后，只在解锁后的第一晚出现。
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

test('四晚合同：Codex/Claude 各四次来访、隐藏角色至少两次、每次两种回应、所有对白不超过 400 字符', () => {
  assert.equal(contract.version, 4);
  assert.deepEqual(ids, ['codex', 'claude', 'cursor', 'workbuddy']);
  assert.deepEqual(core.ids, ids);
  assert.equal(core.constants.nights, 4);
  assert.equal(contract.constants.nights, 4);
  assert.deepEqual(contract.modes, modes);
  assert.equal(story.title, contract.title);
  assert.equal(story.rounds, undefined, '现行剧情不应继续导出旧 rounds');
  lines(story.intro, 'intro');
  assert(Array.isArray(story.nights));
  assert.equal(story.nights.length, 4);
  assert.equal(new Set(story.nights.map(night => night.title)).size, 4);
  story.nights.forEach((night, index) => {
    text(night.title, `nights.${index}.title`);
    lines(night.common, `nights.${index}.common`);
  });
  keys(story.routes, ids, 'routes');
  for (const id of ids) {
    assert(Array.isArray(story.routes[id]));
    // Cursor/WorkBuddy 最早第三晚解锁，最多来访两次；Codex/Claude 可四晚都来访。
    const hidden = core.constants.characters[id].hidden;
    assert.equal(hidden, contract.constants.characters[id].hidden);
    if (hidden) assert(story.routes[id].length >= 2 && story.routes[id].length <= 4, `${id} 至少包含两次来访`);
    else assert.equal(story.routes[id].length, 4, `${id} 必须包含四次来访，而非按日历晚数索引人物剧情`);
    for (const [visit, route] of story.routes[id].entries()) {
      const location = `routes.${id}.${visit}`;
      text(route.title, `${location}.title`);
      lines(route.lines, `${location}.lines`);
      assert(Array.isArray(route.choices));
      assert.equal(route.choices.length, 2, `${location} 必须两选一`);
      assert.equal(new Set(route.choices.map(choice => choice.label)).size, 2, `${location} 回应标签不可重复`);
      route.choices.forEach((choice, index) => {
        text(choice.label, `${location}.choices.${index}.label`);
        lines(choice.reply, `${location}.choices.${index}.reply`);
      });
    }
  }
  allLineTexts(story).forEach((value, index) => text(value, `全部对白.${index}`));
});

test('夜晚开场：四人各有次晨反应，Codex 全局重置与零注意到新室友的开场齐全', () => {
  keys(story.openings, ['after', 'codexReset', 'unlock'], 'openings');
  keys(story.openings.after, ids, 'openings.after');
  for (const id of ids) lines(story.openings.after[id], `openings.after.${id}`);
  lines(story.openings.codexReset, 'openings.codexReset');
  lines(story.openings.unlock, 'openings.unlock');
  assert(story.openings.codexReset.some(line => /重置/.test(line.text)), 'codexReset 必须交代官方重置');
  // 解锁开场要让两位隐藏角色都有登场线索。
  const unlockText = story.openings.unlock.map(line => line.text).join('');
  assert.match(unlockText, /WorkBuddy/);
  // 开场片段只在第二晚以后出现，和 UI openingLines 同一规则。
  assert.deepEqual(openingLines(core.createState()), []);
  assert.deepEqual(unlockLines(core.createState()), []);
  const reset = core.advance(core.commit(core.choose(core.select(core.createState(), 'codex'), 0), 'greedy'));
  assert.deepEqual(openingLines(reset), [...story.openings.after.codex, ...story.openings.codexReset]);
  assert.deepEqual(unlockLines(reset), []);
  const unlocked = core.advance(core.commit(core.choose(core.select(reset, 'claude'), 0), 'greedy'));
  assert.deepEqual(openingLines(unlocked), story.openings.after.claude);
  assert.deepEqual(unlockLines(unlocked), story.openings.unlock, '解锁片段在解锁后的第一晚、公共对白之后播放');
  const later = core.advance(core.commit(core.choose(core.select(unlocked, 'cursor'), 0), 'deep'));
  assert.deepEqual(openingLines(later), story.openings.after.cursor);
  assert.deepEqual(unlockLines(later), [], '解锁片段只播一次');
  // UI 公共阶段顺序：次晨反应 → 当晚公共对白 → 解锁片段。
  assert(fs.readFileSync(path.join(__dirname, '../src/ui/app.js'), 'utf8').includes("[...openingLines(game), ...D.nights[game.night - 1].common, ...unlockLines(game)]"), 'UI common 阶段须为次晨反应、公共对白、解锁片段');
});

test('手写补给场景 supplements.claude.deep 保留且有效', () => {
  lines(story.supplements.claude.deep, 'supplements.claude.deep');
  assert(story.supplements.claude.deep.length > 0);
});

test('三种模式的首次、重复、晨间补给与三种重访对白齐全', () => {
  for (const group of ['supplements', 'repeatSupplements', 'morning']) {
    keys(story[group], ids, group);
    for (const id of ids) {
      keys(story[group][id], modes, `${group}.${id}`);
      for (const mode of modes) lines(story[group][id][mode], `${group}.${id}.${mode}`);
    }
  }
  keys(story.returnLines, ids, 'returnLines');
  for (const id of ids) {
    keys(story.returnLines[id], ['consecutive', 'afterGreedy', 'switched'], `returnLines.${id}`);
    for (const [kind, group] of Object.entries(story.returnLines[id])) lines(group, `returnLines.${id}.${kind}`);
    for (const mode of modes) {
      assert.notDeepEqual(story.supplements[id][mode], story.repeatSupplements[id][mode], `${id}.${mode} 重复补给不能照抄首次对白`);
    }
  }
});

test('全部角色成年，人物字段与本地素材合同一致', () => {
  keys(story.characters, ids, 'characters');
  for (const id of ids) {
    const character = story.characters[id];
    assert.equal(character.id, id);
    assert(Number.isInteger(character.age) && character.age >= 18, `${id} 必须是成年人`);
    ['name', 'gender', 'animal', 'role', 'tagline', 'bio'].forEach(field => text(character[field], `characters.${id}.${field}`));
    assert.match(character.color, /^#[0-9a-f]{6}$/i);
    assert.equal(character.art, `src/assets/${id}.webp`);
  }
  const introduction = story.intro.map(line => line.text).join('\n');
  assert.match(introduction, /成年/);
  assert.match(introduction, /二十六|26/);
});

test('六个结局均有独立标题、后记说明和有效对白', () => {
  assert.deepEqual(contract.endingIds, endingIds);
  keys(story.endings, endingIds, 'endings');
  assert.equal(new Set(Object.values(story.endings).map(ending => ending.title)).size, 6);
  for (const id of endingIds) {
    const ending = story.endings[id];
    ['title', 'subtitle'].forEach(field => text(ending[field], `endings.${id}.${field}`));
    lines(ending.lines, `endings.${id}.lines`);
  }
});

test('CG 映射恰好包含十二个唯一事件键，不以人物图代替事件图', () => {
  keys(story.cgMap, ids, 'cgMap');
  const events = [];
  for (const id of ids) {
    keys(story.cgMap[id], modes, `cgMap.${id}`);
    for (const mode of modes) {
      assert.equal(story.cgMap[id][mode], `${id}_${mode}`);
      events.push(story.cgMap[id][mode]);
    }
  }
  assert.equal(events.length, 12);
  assert.equal(new Set(events).size, 12);
  assert(events.every(key => ![...ids, 'room'].includes(key)));
});

test('结局 CG 映射恰好六个 ending_<id> 键，与事件图和人物图互不重复', () => {
  keys(story.endingCg, endingIds, 'endingCg');
  const endingKeys = endingIds.map(id => story.endingCg[id]);
  endingIds.forEach(id => assert.equal(story.endingCg[id], `ending_${id}`));
  assert.equal(new Set(endingKeys).size, 6);
  const events = ids.flatMap(id => modes.map(mode => story.cgMap[id][mode]));
  assert(endingKeys.every(key => !events.includes(key) && ![...ids, 'room', 'cover'].includes(key)));
});

test('可玩文本禁用词与长度检查不扫描历史文档、来源或规则', async () => {
  const { playableTexts } = await import('../scripts/verify.mjs');
  const patterns = [/不是[^。！？\n]*?而是/u, /仿佛/u, /总而言之/u, /令人窒息的张力/u, /不禁/u, /忍不住/u];
  const fields = playableTexts(story);
  assert(fields.length > 0);
  for (const field of fields) {
    text(field.text, field.path);
    for (const pattern of patterns) assert(!pattern.test(field.text), `${field.path} 含禁用表达 ${pattern.source}`);
  }
});

test('现行剧情和 UI 彻底移除排插、插排、终端、交付、校准用语', () => {
  const removed = /排插|插排|终端|交付|校准/u;
  const { sources: historicalReferences, ...playableStory } = story;
  assert(!removed.test(JSON.stringify(playableStory)), '现行 story 仍有旧主题用语');
  const app = fs.readFileSync(path.join(__dirname, '../src/ui/app.js'), 'utf8');
  assert(!removed.test(app), '现行 UI 仍有旧主题用语');
});

test('UI 接入规则 v4：存档命名空间、逐晚夜耗与饱食上限不再写死旧数值', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/ui/app.js'), 'utf8');
  assert.match(app, /namespace = 'token-four-nights-v4'/);
  assert.doesNotMatch(app, /namespace = 'token-four-nights-v3'/);
  assert.doesNotMatch(app, /C\.constants\.drain\b/, 'v4 没有单一 drain，模式卡须用 preview 的 drain');
  assert.doesNotMatch(app, /每晚消耗 20/, '玩法说明须改为逐晚夜耗');
  assert.match(app, /20、25、30、35/);
  assert.match(app, /只顶一半饱/);
  assert.deepEqual(core.constants.drains, contract.constants.drains);
  assert.equal(core.constants.maxEnergy, 60);
});

test('离线检查接受完整 SVG data URI，不误报内部滤镜引用', async () => {
  const { resourceChecks } = await import('../scripts/verify.mjs');
  const css = fs.readFileSync(path.join(__dirname, '../src/ui/styles.css'), 'utf8');
  assert.doesNotThrow(() => resourceChecks('<main></main>', [], css));
  const svg = `body{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect filter='url(%23grain)'/%3E%3C/svg%3E")}`;
  assert.doesNotThrow(() => resourceChecks('', [], svg));
  assert.doesNotThrow(() => resourceChecks('<a href="https://example.com/">来源</a>', [], ''));
  assert.throws(() => resourceChecks('', [], 'body{background:url("https://example.com/image.webp")}'), /非内嵌/);
  assert.throws(() => resourceChecks('', [], 'body{background:url(local.webp)}'), /非内嵌/);
  assert.throws(() => resourceChecks('', ['fetch("/api")'], ''), /网络/);
});

test('发行 WebP 分块拒绝截断和长度篡改', async () => {
  const { checkWebp } = await import('../scripts/build.mjs');
  const image = fs.readFileSync(path.join(__dirname, '../src/assets/codex.webp'));
  assert.equal(checkWebp(image, 'codex').chunksComplete, true);
  assert.throws(() => checkWebp(image.subarray(0, image.length - 1), 'cut'), /长度|截断/);
  const altered = Buffer.from(image); altered.writeUInt32LE(image.length, 4);
  assert.throws(() => checkWebp(altered, 'changed'), /长度/);
});

test('四人立绘 WebP 必须包含真实 Alpha 通道', () => {
  for (const id of ids) {
    const bytes = fs.readFileSync(path.join(__dirname, '../src/assets', `${id}.webp`));
    let alpha = false;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const kind = bytes.toString('ascii', offset, offset + 4);
      const size = bytes.readUInt32LE(offset + 4);
      if (kind === 'ALPH') alpha = true;
      if (kind === 'VP8X' && size >= 10 && (bytes[offset + 8] & 0x10)) alpha = true;
      if (kind === 'VP8L' && size >= 5 && (bytes[offset + 12] & 0x10)) alpha = true;
      offset += 8 + size + (size % 2);
    }
    assert(alpha, `${id} 缺少透明通道，不能使用有底色的画卡冒充立绘`);
  }
});

test('源码 ZIP 可复现、支持中文并拒绝损坏和路径穿越', async () => {
  const { createZip, validateZip } = await import('../scripts/package.mjs');
  const entries = [{ name: 'docs/说明.txt', data: Buffer.from('离线测试') }, { name: 'index.html', data: Buffer.from('<main>ok</main>') }];
  const zip = createZip(entries);
  assert(zip.equals(createZip(entries)));
  assert.equal(validateZip(zip, entries).crc32Checked, 2);
  const damaged = Buffer.from(zip); damaged[30 + Buffer.byteLength(entries[0].name)] ^= 1;
  assert.throws(() => validateZip(damaged, entries), /CRC32/);
  assert.throws(() => createZip([{ name: '../escape.txt', data: Buffer.from('x') }]), /穿越/);
});

test('统计真实 demoRoute 四晚字数，不推断或断言游玩时长', (context) => {
  const inventory = allLineTexts(story);
  const sample = [...story.intro];
  const scenes = [];
  let state = core.createState();
  let supportCharacters = 0;
  assert.equal(demoRoute.length, 4);
  for (const { id, choice, mode } of demoRoute) {
    assert.equal(state.phase, 'select', '演示样本提前终局');
    const night = story.nights[state.night - 1];
    const route = story.routes[id][state.characters[id].visits];
    const previous = state.history.filter(entry => entry.character === id).at(-1);
    const returnKind = !previous ? null : previous.mode === 'greedy' && state.night >= previous.night + 2
      ? 'afterGreedy' : previous.night === state.night - 1 ? 'consecutive' : 'switched';
    const repeated = state.history.some(entry => entry.character === id && entry.mode === mode);
    sample.push(...openingLines(state), ...night.common, ...(returnKind ? story.returnLines[id][returnKind] : []), ...route.lines, ...route.choices[choice].reply);
    supportCharacters += [night.title, route.title, ...route.choices.map(item => item.label)].reduce((sum, value) => sum + length(value), 0);
    state = core.select(state, id);
    state = core.choose(state, choice);
    assert(core.preview(state, id, mode).allowed, '演示样本行动不可执行');
    state = core.commit(state, mode);
    assert(state.energy > 0, '正常四晚演示不应触发 UI 的饥饿替代片段');
    const group = repeated ? 'repeatSupplements' : 'supplements';
    sample.push(...story[group][id][mode], ...story.morning[id][mode]);
    scenes.push({ night: state.night, id, visit: state.lastResult.visit, choice, mode, supplement: group, returnKind });
    state = core.advance(state);
  }
  assert.equal(state.phase, 'ended');
  assert.equal(state.night, 4);
  assert.equal(state.history.length, 4);
  assert(story.endings[state.endingId]);
  sample.push(...story.endings[state.endingId].lines);
  const sampleCharacters = sample.reduce((sum, line) => sum + length(line.text), 0);
  assert(sampleCharacters > 0);
  context.diagnostic(JSON.stringify({
    kind: '真实规则路径的文本统计；不是真人计时，也不是 UI DOM 验证',
    unit: 'Unicode 码点，包含标点、空格、英文字母；不是词数或 token 数',
    inventoryLineEntries: inventory.length,
    inventoryNarrativeCharacters: inventory.reduce((sum, value) => sum + length(value), 0),
    maximumLineCharacters: Math.max(...inventory.map(length)),
    sample: {
      route: balance.demoRoute ? 'tests/balance.cjs demoRoute' : 'tests/balance.cjs fixedRoutes.household（本测试的 demoRoute）',
      nights: state.history.length, endingId: state.endingId, lineEntries: sample.length,
      narrativeCharacters: sampleCharacters, additionalTitleAndChoiceCharacters: supportCharacters, scenes
    }
  }));
});

test('六条固定路线每次来访都有对应剧情段落，隐藏角色的来访次数不超过剧情条数', () => {
  for (const [ending, route] of Object.entries(balance.fixedRoutes)) {
    let state = core.createState();
    for (const { id, choice, mode } of route) {
      assert(story.routes[id][state.characters[id].visits], `${ending} 路线缺少 ${id} 第 ${state.characters[id].visits + 1} 次来访剧情`);
      state = core.advance(core.commit(core.choose(core.select(state, id), choice), mode));
    }
    assert.equal(state.endingId, ending);
  }
  // 隐藏角色最早第三晚出现，因此最多两次来访。
  for (const id of ids.filter(id => core.constants.characters[id].hidden)) {
    assert(story.routes[id].length >= core.constants.nights - core.constants.unlockAfter.length);
  }
});
