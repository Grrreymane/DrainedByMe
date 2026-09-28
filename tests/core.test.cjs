'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { core, ids, endings, modes, fixedRoutes, runRoute, generateFixtures, legalOptions, rng } = require('./balance.cjs');
const copy = (value) => JSON.parse(JSON.stringify(value));

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function ready(state, id, choice = 0) { return core.choose(core.select(state, id), choice); }
function result(state, id, mode = 'deep', choice = 0) { return core.commit(ready(state, id, choice), mode); }
function night(state, id, mode = 'deep', choice = 0) { return core.advance(result(state, id, mode, choice)); }
const hiddenIds = ids.filter((id) => core.constants.characters[id].hidden);
const hiddenReason = /零现在眼里只有 Codex 和 Claude/;
// 前两晚分别榨干 Codex 与 Claude，第三晚 select 阶段 Cursor/WorkBuddy 已出现（Claude 本晚休息）。
// v4 结算公式：feed=floor(cost*nourish)，raw=energy+feed-drains[night-1]，夹在 0..60，超出部分为 wasted。
function expectedEnergy(state, id, cost) {
  const feed = Math.floor(cost * core.constants.characters[id].nourish);
  const drain = core.constants.drains[state.night - 1];
  const raw = state.energy + feed - drain;
  return { feed, drain, energyAfter: Math.max(0, Math.min(60, raw)), wasted: Math.max(0, raw - 60) };
}
function contractState() { return JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/design/contracts.json'), 'utf8')).stateRequired; }
function unlockedNightThree() { return night(night(core.createState(), 'codex', 'greedy'), 'claude', 'greedy'); }
function immutableFailure(state, operation) {
  const before = copy(state);
  assert.throws(operation);
  assert.deepEqual(state, before);
}
function roundTrip(state) {
  const before = copy(state);
  const checked = core.validateState(state);
  const saved = core.serialize(state);
  const loaded = core.deserialize(saved);
  assert.deepEqual(checked, state);
  assert.deepEqual(loaded, state);
  assert.notEqual(checked, state);
  assert.notEqual(loaded, state);
  assert.notEqual(loaded.characters, state.characters);
  assert.notEqual(loaded.characters.codex, state.characters.codex);
  assert.notEqual(loaded.actions, state.actions);
  assert.notEqual(loaded.history, state.history);
  if (state.lastResult) assert.notEqual(loaded.lastResult, loaded.history.at(-1));
  assert.deepEqual(state, before);
  return loaded;
}
function bounds(state) {
  const range = (value, min, max) => assert.ok(Number.isSafeInteger(value) && value >= min && value <= max);
  range(state.night, 1, 4);
  range(state.energy, 0, 60);
  range(state.actions.length, 0, 16);
  range(state.history.length, 0, 4);
  let visits = 0;
  for (const id of ids) {
    const person = state.characters[id];
    const rules = core.constants.characters[id];
    assert.equal(person.cap, rules.caps[state.night - 1]);
    assert.equal(person.cap, core.capFor(id, state.night));
    range(person.tokens, 0, person.cap);
    range(person.visits, 0, 4);
    range(person.affinity, person.visits, person.visits * 2);
    range(person.blockedNight, 0, 5);
    range(person.resets, 0, rules.resets);
    const greedies = state.history.filter((entry) => entry.character === id && entry.mode === 'greedy');
    assert.equal(person.resets, Math.min(rules.resets, greedies.length));
    visits += person.visits;
    if (person.blockedNight === state.night) assert.equal(person.tokens, 0);
    // 隐藏角色在两位解锁者都被 greedy 过之前不可能有来访记录，且只能出现在解锁之后的夜晚。
    if (rules.hidden) {
      const firstVisit = state.history.findIndex((entry) => entry.character === id);
      if (firstVisit !== -1) assert.ok(core.unlocked({ history: state.history.slice(0, firstVisit) }));
      range(person.visits, 0, 2);
    }
  }
  const unlockedNow = core.constants.unlockAfter.every((id) => state.history.some((entry) => entry.character === id && entry.mode === 'greedy'));
  assert.equal(core.unlocked(state), unlockedNow);
  assert.equal(visits, state.history.length);
  assert.equal(state.history.length, ['result', 'ended'].includes(state.phase) ? state.night : state.night - 1);
  assert.equal(state.actions.filter((action) => action.type === 'commit').length, state.history.length);
  if (state.phase === 'ended') assert.ok(endings.includes(state.endingId));
  else assert.equal(state.endingId, null);
}
function previewMatches(state, mode) {
  const before = copy(state);
  const offer = core.preview(freeze(state), state.selected, mode);
  const person = state.characters[state.selected];
  assert.ok(offer.allowed, offer.reason);
  const expected = expectedEnergy(state, state.selected, offer.cost);
  assert.equal(offer.feed, expected.feed);
  assert.equal(offer.drain, expected.drain);
  assert.equal(offer.wasted, expected.wasted);
  const resetLeft = person.resets < core.constants.characters[state.selected].resets;
  assert.equal(offer.resetNextNight, mode === 'greedy' && resetLeft);
  assert.equal(offer.blockedNextNight, mode === 'greedy' && !resetLeft);
  assert.ok(!(offer.resetNextNight && offer.blockedNextNight));
  assert.equal(offer.energyAfter, expected.energyAfter);
  const after = core.commit(state, mode);
  assert.equal(after.energy, offer.energyAfter);
  assert.equal(after.characters[state.selected].tokens, offer.tokensAfter);
  assert.equal(after.lastResult.cost, offer.cost);
  assert.equal(after.lastResult.feed, offer.feed);
  assert.equal(after.lastResult.wasted, offer.wasted);
  assert.equal(after.lastResult.blockedNextNight, offer.blockedNextNight);
  assert.equal(after.lastResult.resetNextNight, offer.resetNextNight);
  assert.equal(after.lastResult.energyBefore, state.energy);
  assert.equal(after.lastResult.energyAfter, offer.energyAfter);
  assert.equal(after.lastResult.visit, person.visits + 1);
  assert.equal(after.characters[state.selected].affinity, person.affinity + (state.choice === 0 ? 2 : 1));
  assert.equal(after.characters[state.selected].blockedNight, offer.blockedNextNight ? state.night + 1 : person.blockedNight);
  assert.equal(after.characters[state.selected].resets, person.resets + (offer.resetNextNight ? 1 : 0));
  assert.equal(after.night, state.night);
  assert.equal(after.phase, 'result');
  assert.equal(after.endingId, null);
  assert.deepEqual(after.lastResult, after.history.at(-1));
  for (const id of ids) if (id !== state.selected) assert.deepEqual(after.characters[id], state.characters[id]);
  assert.deepEqual(state, before);
  return after;
}

test('新合同、精确导出 API、初始值和冻结常量', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/design/contracts.json'), 'utf8'));
  const names = ['constants', 'ids', 'createState', 'select', 'choose', 'preview', 'commit', 'advance', 'serialize', 'deserialize', 'validateState', 'unlocked', 'capFor', 'drainFor'];
  assert.deepEqual(Object.keys(core).sort(), names.sort());
  assert.deepEqual(Object.keys(contract.coreAPI).sort(), names.sort());
  assert.equal(contract.version, 4);
  assert.deepEqual(core.constants, contract.constants);
  assert.deepEqual(core.createState(), contract.stateRequired);
  assert.equal(core.createState().version, 4);
  assert.deepEqual(contract.resultFields, Object.keys(result(core.createState(), 'codex').lastResult));
  assert.deepEqual(core.ids, ['codex', 'claude', 'cursor', 'workbuddy']);
  assert.deepEqual(core.constants.characters, {
    codex: { caps: [90, 90, 90, 90], regen: 0, resets: 1, hidden: false, nourish: 1 },
    claude: { caps: [30, 38, 46, 54], regen: 100, resets: 0, hidden: false, nourish: 1 },
    cursor: { caps: [55, 55, 55, 55], regen: 12, resets: 0, hidden: true, nourish: 1 },
    workbuddy: { caps: [110, 110, 110, 110], regen: 20, resets: 0, hidden: true, nourish: 0.5 }
  });
  assert.deepEqual(core.constants.unlockAfter, ['codex', 'claude']);
  assert.deepEqual(core.constants.costs, { shallow: 10, deep: 26 });
  assert.equal(core.constants.regen, undefined, 'v3 起不再有全局 regen');
  assert.equal(core.constants.drain, undefined, 'v4 用逐晚 drains 取代单一 drain');
  assert.deepEqual([core.constants.nights, core.constants.initialEnergy, core.constants.maxEnergy], [4, 28, 60]);
  assert.deepEqual(core.constants.drains, [20, 25, 30, 35]);
  for (const id of ids) for (let n = 1; n <= 4; n += 1) assert.equal(core.capFor(id, n), core.constants.characters[id].caps[n - 1]);
  assert.deepEqual([1, 2, 3, 4].map((n) => core.drainFor(n)), [20, 25, 30, 35]);
  assert.deepEqual(ids.map((id) => core.createState().characters[id].tokens), [90, 30, 55, 110]);
  assert.ok(Object.isFrozen(core));
  assert.ok(Object.isFrozen(core.ids));
  assert.ok(Object.isFrozen(core.constants.characters.claude.caps));
  assert.ok(Object.isFrozen(core.constants.unlockAfter));
  assert.ok(Object.isFrozen(core.constants.drains));
  assert.throws(() => core.ids.push('extra'));
  assert.throws(() => { core.constants.characters.codex.caps[0] = 1; });
  assert.throws(() => { core.constants.characters.cursor.hidden = false; });
  assert.throws(() => core.constants.unlockAfter.push('cursor'));
  assert.throws(() => { core.constants.costs.deep = 1; });
  assert.throws(() => { core.constants.drains[3] = 0; });
  assert.throws(() => { core.constants.characters.workbuddy.nourish = 1; });
  assert.throws(() => { core.constants.maxEnergy = 100; });
  const state = core.createState();
  state.characters.codex.tokens = 0;
  state.actions.push({ type: 'advance' });
  assert.equal(core.createState().characters.codex.tokens, 90);
  assert.deepEqual(core.createState().actions, []);
});

test('UMD 浏览器与 Node 无需 story 或其他依赖，规则无随机、时钟或 DOM', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/engine/core.js'), 'utf8');
  assert.doesNotMatch(source, /Math\.random|\bDate\b|\bdocument\b|\beval\s*\(|new\s+Function|AfterhoursStory|\brequire\s*\(/);
  const browser = {};
  vm.runInNewContext(source, browser);
  assert.equal(typeof browser.AfterhoursCore.commit, 'function');
  const node = { module: { exports: {} }, require() { throw new Error('不允许外部依赖'); } };
  vm.runInNewContext(source, node);
  for (const engine of [browser.AfterhoursCore, node.module.exports]) {
    assert.equal(JSON.stringify(engine.createState()), JSON.stringify(core.createState()));
    const state = runRoute(engine, fixedRoutes.codex);
    const native = runRoute(core, fixedRoutes.codex);
    const saved = engine.serialize(state);
    assert.equal(JSON.stringify(state), JSON.stringify(native));
    assert.equal(engine.serialize(engine.deserialize(saved)), core.serialize(native));
    assert.deepEqual(core.deserialize(saved), native);
    assert.equal(engine.serialize(engine.deserialize(core.serialize(native))), saved);
  }
});

test('select 与 choose 仅进入阶段并记录操作，计数和亲密度仅在 commit 增加', () => {
  for (const choice of [0, 1]) {
    const start = freeze(core.createState());
    const talk = freeze(core.select(start, 'codex'));
    assert.equal(talk.phase, 'talk');
    assert.equal(talk.selected, 'codex');
    assert.equal(talk.choice, null);
    assert.deepEqual(talk.characters, start.characters);
    const mode = freeze(core.choose(talk, choice));
    assert.equal(mode.phase, 'mode');
    assert.equal(mode.choice, choice);
    assert.deepEqual(mode.characters, start.characters);
    const after = previewMatches(mode, 'deep');
    assert.equal(after.characters.codex.visits, 1);
    assert.equal(after.characters.codex.affinity, choice === 0 ? 2 : 1);
    assert.deepEqual(after.actions, [{ type: 'select', id: 'codex' }, { type: 'choose', index: choice }, { type: 'commit', mode: 'deep' }]);
    assert.deepEqual(start, core.createState());
  }
});

test('所有阶段拒绝越序、重复操作；result/ended 不允许预览', () => {
  const start = core.createState();
  const talk = core.select(start, 'codex');
  const mode = core.choose(talk, 0);
  const settled = core.commit(mode, 'deep');
  const ended = runRoute(core, fixedRoutes.household);
  const operations = {
    select: (state) => core.select(state, 'codex'), talk: (state) => core.choose(state, 0),
    mode: (state) => core.commit(state, 'deep'), result: (state) => core.advance(state)
  };
  for (const state of [start, talk, mode, settled, ended]) {
    freeze(state);
    for (const [phase, operation] of Object.entries(operations)) {
      if (state.phase !== phase) immutableFailure(state, () => operation(state));
    }
    assert.equal(core.preview(state, 'codex', 'deep').allowed, ['select', 'talk', 'mode'].includes(state.phase));
    roundTrip(state);
  }
});

test('非法角色、模式、回应索引与原型名称不会改变输入', () => {
  const start = freeze(core.createState());
  const talk = freeze(core.select(start, 'codex'));
  const modeState = freeze(core.choose(talk, 0));
  const invalid = ['missing', '__proto__', 'constructor', 'prototype', null, undefined, {}, [], ['codex'], 0, NaN, Infinity, Symbol('bad')];
  for (const id of invalid) {
    assert.equal(core.preview(start, id, 'deep').allowed, false);
    immutableFailure(start, () => core.select(start, id));
  }
  for (const mode of [...invalid, 'focus', 'parallel', 'rest']) {
    assert.equal(core.preview(modeState, 'codex', mode).allowed, false);
    immutableFailure(modeState, () => core.commit(modeState, mode));
  }
  for (const index of [-1, 2, 0.5, NaN, Infinity, '0', '1', null, undefined, {}, [], true]) {
    immutableFailure(talk, () => core.choose(talk, index));
  }
});

test('select 只要求未锁定且有 Token，不要求付得起固定消耗', () => {
  for (const tokens of [0, 1, 10, 26]) {
    const state = core.createState();
    state.characters.codex.tokens = tokens;
    if (tokens === 0) immutableFailure(state, () => core.select(state, 'codex'));
    else assert.equal(core.select(freeze(state), 'codex').phase, 'talk');
    assert.equal(core.preview(state, 'codex', 'greedy').allowed, tokens > 0);
  }
  const blocked = core.createState();
  blocked.characters.codex.blockedNight = 1;
  immutableFailure(blocked, () => core.select(blocked, 'codex'));
  for (const mode of modes) {
    const offer = core.preview(blocked, 'codex', mode);
    assert.equal(offer.allowed, false);
    assert.match(offer.reason, /本晚暂停选择/);
  }
});

test('Cursor 与 WorkBuddy 隐藏：Codex、Claude 都被 greedy 过之后才可选', () => {
  const start = freeze(core.createState());
  assert.equal(core.unlocked(start), false);
  for (const id of hiddenIds) {
    assert.throws(() => core.select(start, id), hiddenReason);
    immutableFailure(start, () => core.select(start, id));
    for (const mode of modes) {
      const offer = core.preview(start, id, mode);
      assert.equal(offer.allowed, false);
      assert.match(offer.reason, hiddenReason);
      assert.equal(offer.cost, mode === 'greedy' ? start.characters[id].tokens : core.constants.costs[mode]);
    }
  }
  assert.deepEqual(ids.filter((id) => core.preview(start, id, 'deep').allowed), ['codex', 'claude']);
  // 只榨干其中一人或只做非 greedy 都不解锁。
  const partial = [
    [['codex', 'greedy'], ['claude', 'deep']],
    [['claude', 'greedy'], ['codex', 'deep']],
    [['codex', 'greedy'], ['codex', 'greedy']],
    [['codex', 'deep'], ['claude', 'shallow']]
  ];
  for (const rows of partial) {
    let state = core.createState();
    for (const [id, mode] of rows) state = night(state, id, mode);
    assert.equal(state.night, 3);
    assert.equal(core.unlocked(state), false);
    for (const id of hiddenIds) {
      immutableFailure(state, () => core.select(state, id));
      assert.match(core.preview(state, id, 'shallow').reason, hiddenReason);
    }
  }
  for (const order of [['codex', 'claude'], ['claude', 'codex']]) {
    let state = night(core.createState(), order[0], 'greedy');
    assert.equal(core.unlocked(state), false);
    state = result(state, order[1], 'greedy');
    assert.equal(core.unlocked(state), true, '第二次 greedy 结算后 history 已满足解锁条件');
    state = roundTrip(core.advance(state));
    assert.equal(state.night, 3);
    for (const id of hiddenIds) {
      assert.equal(core.select(state, id).phase, 'talk');
      assert.equal(core.preview(state, id, 'deep').allowed, true);
      assert.equal(core.preview(state, id, 'deep').reason, '');
    }
  }
  // 解锁由 history 决定，与 night 或 tokens 无关。
  assert.equal(core.unlocked({ history: [{ character: 'claude', mode: 'greedy' }, { character: 'codex', mode: 'greedy' }] }), true);
  assert.equal(core.unlocked({ history: [{ character: 'cursor', mode: 'greedy' }, { character: 'codex', mode: 'greedy' }] }), false);
});

test('固定消耗严格要求 tokens>cost，边界只允许 greedy 清零', () => {
  for (const id of ids) for (const mode of ['shallow', 'deep']) {
    const cost = core.constants.costs[mode];
    for (const tokens of [cost - 1, cost, cost + 1]) {
      const state = ready(core.constants.characters[id].hidden ? unlockedNightThree() : core.createState(), id);
      state.characters[id].tokens = tokens;
      const offer = core.preview(freeze(state), id, mode);
      assert.equal(offer.cost, cost);
      assert.equal(offer.allowed, tokens > cost);
      if (tokens <= cost) {
        assert.match(offer.reason, /大于/);
        immutableFailure(state, () => core.commit(state, mode));
      } else assert.equal(core.commit(state, mode).characters[id].tokens, 1);
      assert.equal(core.commit(state, 'greedy').characters[id].tokens, 0);
    }
  }
});

test('四晚完整流程：每晚结算可读，advance 才推进，最终无第五晚', () => {
  let state = core.createState();
  const route = ['codex', 'claude', 'codex', 'claude'];
  for (let index = 0; index < 4; index += 1) {
    const before = copy(state);
    state = result(freeze(state), route[index], 'deep', 1);
    assert.equal(state.night, index + 1);
    assert.equal(state.phase, 'result');
    assert.equal(state.energy, [34, 35, 31, 22][index], '深补 +26 对上逐晚夜耗 20/25/30/35');
    assert.equal(state.endingId, null);
    assert.deepEqual(state.lastResult, {
      night: index + 1, character: route[index], mode: 'deep', choice: 1,
      cost: 26, feed: 26, energyBefore: before.energy, energyAfter: state.energy, wasted: 0, visit: index < 2 ? 1 : 2,
      blockedNextNight: false, resetNextNight: false
    });
    const last = copy(state.lastResult);
    const characters = copy(state.characters);
    state = core.advance(freeze(state));
    assert.deepEqual(state.lastResult, last);
    if (index < 3) {
      assert.equal(state.night, index + 2);
      assert.equal(state.phase, 'select');
      assert.equal(state.selected, null);
      assert.equal(state.choice, null);
    } else {
      assert.equal(state.night, 4);
      assert.equal(state.phase, 'ended');
      assert.equal(state.endingId, 'household');
      assert.deepEqual(state.characters, characters);
    }
    bounds(state);
    roundTrip(state);
  }
  assert.equal(state.actions.length, 16);
});

test('连续三次 shallow：18→3→0，低值警告且致命选项仍允许', () => {
  let state = core.createState();
  for (const expected of [18, 3, 0]) {
    const offer = core.preview(freeze(state), 'codex', 'shallow');
    assert.equal(offer.allowed, true);
    assert.equal(offer.energyAfter, expected);
    assert.equal(offer.fatal, expected === 0);
    assert.equal(Boolean(offer.warning), expected <= 10);
    if (expected === 0) assert.match(offer.warning, /归零.*饥饿结局.*确认/);
    state = result(state, 'codex', 'shallow');
    assert.equal(state.energy, expected);
    assert.equal(state.phase, 'result');
    state = core.advance(state);
  }
  assert.equal(state.phase, 'ended');
  assert.equal(state.endingId, 'hunger');
  assert.equal(state.night, 3);
  assert.equal(state.actions.length, 12);
  roundTrip(state);
});

test('致命 commit 停留 result，重载仍可读，advance 才失败且不恢复 Token', () => {
  let state = night(night(core.createState(), 'codex', 'shallow'), 'claude', 'shallow');
  state = result(state, 'claude', 'shallow');
  assert.equal(state.energy, 0);
  assert.equal(state.endingId, null);
  assert.equal(state.phase, 'result');
  assert.equal(state.selected, 'claude');
  assert.equal(state.characters.claude.tokens, 36);
  assert.equal(state.choice, 0);
  assert.equal(state.lastResult.night, 3);
  assert.equal(state.history.length, 3);
  const loaded = roundTrip(freeze(state));
  const ended = core.advance(loaded);
  assert.equal(ended.endingId, 'hunger');
  assert.equal(ended.night, state.night);
  assert.deepEqual(ended.characters, state.characters);
  assert.deepEqual(ended.lastResult, state.lastResult);
  assert.deepEqual(ended.history, state.history);
});

test('Claude 第一晚 greedy 清零，第二晚锁定含重载，第三晚按新上限满额恢复可选', () => {
  let state = result(core.createState(), 'claude', 'greedy');
  assert.equal(state.lastResult.cost, 30);
  assert.equal(state.energy, 28 + 30 - 20);
  assert.equal(state.characters.claude.tokens, 0);
  assert.equal(state.characters.claude.blockedNight, 2);
  assert.equal(state.characters.claude.resets, 0);
  assert.equal(state.lastResult.blockedNextNight, true);
  assert.equal(state.lastResult.resetNextNight, false);
  state = roundTrip(state);
  state = roundTrip(core.advance(state));
  assert.equal(state.night, 2);
  assert.equal(state.characters.claude.cap, 38);
  assert.equal(state.characters.claude.tokens, 0);
  immutableFailure(state, () => core.select(state, 'claude'));
  for (const mode of modes) {
    const offer = core.preview(state, 'claude', mode);
    assert.equal(offer.allowed, false);
    assert.match(offer.reason, /本晚暂停选择/);
  }
  state = result(state, 'codex');
  assert.equal(state.characters.claude.tokens, 0);
  state = roundTrip(core.advance(roundTrip(state)));
  assert.equal(state.night, 3);
  assert.equal(state.characters.claude.cap, 46);
  assert.equal(state.characters.claude.tokens, 46);
  assert.equal(state.characters.claude.blockedNight, 2, '历史锁定数字保留，直到下一次锁定覆写');
  assert.equal(core.select(state, 'claude').phase, 'talk');
  assert.equal(core.preview(state, 'claude', 'deep').allowed, true);
});

test('Codex 第一次 greedy 触发一次性全局重置：次晚回满不休息，之后再 greedy 照常锁定', () => {
  let state = ready(core.createState(), 'codex');
  const offer = core.preview(state, 'codex', 'greedy');
  assert.equal(offer.cost, 90);
  assert.equal(offer.tokensAfter, 0);
  assert.equal(offer.resetNextNight, true);
  assert.equal(offer.blockedNextNight, false);
  assert.equal(offer.feed, 90);
  assert.equal(offer.drain, 20);
  assert.equal(offer.energyAfter, 60, '28+90-20=98，夹在饱食上限 60');
  assert.equal(offer.wasted, 38, '吃不下的 38 溢出浪费');
  state = roundTrip(core.commit(state, 'greedy'));
  assert.equal(state.energy, 60);
  assert.equal(state.lastResult.feed, 90);
  assert.equal(state.lastResult.wasted, 38);
  assert.equal(state.characters.codex.tokens, 0);
  assert.equal(state.characters.codex.resets, 1);
  assert.equal(state.characters.codex.blockedNight, 0, '重置不写入锁定');
  assert.equal(state.lastResult.resetNextNight, true);
  assert.equal(state.lastResult.blockedNextNight, false);
  state = roundTrip(core.advance(state));
  assert.equal(state.night, 2);
  assert.equal(state.characters.codex.tokens, 90, '全局重置：清零后次晚回满');
  assert.equal(core.select(state, 'codex').phase, 'talk');
  // 重置只有一次：第二次 greedy 与其他角色一样锁下一晚。
  state = ready(state, 'codex');
  const second = core.preview(state, 'codex', 'greedy');
  assert.equal(second.resetNextNight, false);
  assert.equal(second.blockedNextNight, true);
  state = roundTrip(previewMatches(state, 'greedy'));
  assert.equal(state.characters.codex.resets, 1);
  assert.equal(state.characters.codex.blockedNight, 3);
  state = roundTrip(core.advance(state));
  assert.equal(state.night, 3);
  assert.equal(state.characters.codex.tokens, 0);
  immutableFailure(state, () => core.select(state, 'codex'));
  assert.match(core.preview(state, 'codex', 'shallow').reason, /本晚暂停选择/);
  state = roundTrip(night(state, 'claude'));
  assert.equal(state.night, 4);
  assert.equal(state.characters.codex.tokens, 90, '锁定结束后清零角色回满');
  assert.equal(core.preview(state, 'codex', 'greedy').blockedNextNight, true);
  assert.equal(core.preview(state, 'codex', 'greedy').resetNextNight, false);
  // 非 greedy 不消耗重置次数：先 deep 再 greedy，仍是第一次重置。
  const deepFirst = night(night(core.createState(), 'codex', 'deep'), 'codex', 'greedy');
  assert.equal(deepFirst.characters.codex.resets, 1);
  assert.equal(deepFirst.characters.codex.tokens, 90);
  assert.equal(deepFirst.characters.codex.blockedNight, 0);
  assert.equal(deepFirst.history[1].cost, 64);
});

test('其他角色没有重置次数：Cursor/WorkBuddy 第三晚 greedy 锁第四晚', () => {
  for (const id of hiddenIds) {
    let state = ready(unlockedNightThree(), id);
    const offer = core.preview(state, id, 'greedy');
    assert.equal(offer.resetNextNight, false);
    assert.equal(offer.blockedNextNight, true);
    state = roundTrip(previewMatches(state, 'greedy'));
    assert.equal(state.characters[id].resets, 0);
    state = roundTrip(core.advance(state));
    assert.equal(state.night, 4);
    assert.equal(state.characters[id].tokens, 0);
    assert.equal(state.characters[id].blockedNight, 4);
    immutableFailure(state, () => core.select(state, id));
  }
  assert.equal(core.preview(core.createState(), 'claude', 'greedy').resetNextNight, false);
});

test('第四晚 greedy 保留清零和 blockedNight=5，不恢复或新增夜晚', () => {
  let state = night(unlockedNightThree(), 'cursor', 'greedy');
  assert.equal(state.night, 4);
  assert.equal(state.characters.cursor.tokens, 0);
  immutableFailure(state, () => core.select(state, 'cursor'));
  state = result(roundTrip(state), 'workbuddy', 'greedy');
  assert.equal(state.phase, 'result');
  assert.equal(state.night, 4);
  assert.equal(state.characters.workbuddy.tokens, 0);
  assert.equal(state.characters.workbuddy.blockedNight, 5);
  assert.equal(state.lastResult.blockedNextNight, true);
  assert.equal(state.lastResult.cost, 110);
  assert.equal(state.lastResult.feed, 55, 'WorkBuddy 只顶一半饱');
  assert.equal(state.lastResult.wasted, 20, '60+55-35=80，溢出 20');
  assert.equal(state.energy, 60);
  const before = copy(state);
  state = core.advance(roundTrip(state));
  assert.equal(state.night, 4);
  assert.equal(state.phase, 'ended');
  assert.equal(state.endingId, 'household');
  assert.deepEqual(state.characters, before.characters);
  assert.deepEqual(state.lastResult, before.lastResult);
  roundTrip(state);
});

test('多角色 greedy 锁定独立，Codex 重置后再次 greedy 只锁自己的下一晚', () => {
  let state = night(core.createState(), 'codex', 'greedy');
  state = night(state, 'claude', 'greedy');
  assert.equal(state.characters.codex.tokens, 90);
  assert.equal(state.characters.claude.tokens, 0);
  assert.equal(state.characters.claude.blockedNight, 3);
  state = night(state, 'codex', 'greedy');
  assert.equal(state.night, 4);
  assert.equal(state.characters.codex.tokens, 0);
  assert.equal(state.characters.codex.blockedNight, 4);
  assert.equal(state.characters.codex.resets, 1);
  assert.equal(state.characters.claude.tokens, 54);
  assert.equal(state.characters.claude.blockedNight, 3);
  for (const id of hiddenIds) assert.equal(state.characters[id].tokens, core.constants.characters[id].caps[3]);
  state = night(state, 'claude', 'deep');
  assert.equal(state.endingId, 'claude');
  roundTrip(state);
});

test('次日恢复：Claude 每晚回满且上限递增，Codex 不回复，Cursor 每晚加 12、WorkBuddy 每晚加 20，均不超容量', () => {
  const settled = result(core.createState(), 'claude');
  assert.equal(settled.characters.claude.tokens, 4);
  let state = core.advance(freeze(settled));
  assert.equal(state.characters.claude.cap, 38);
  assert.equal(state.characters.claude.tokens, 38);
  state = night(state, 'claude', 'shallow');
  assert.equal(state.characters.claude.cap, 46);
  assert.equal(state.characters.claude.tokens, 46);
  state = night(state, 'codex');
  assert.equal(state.characters.claude.cap, 54);
  assert.equal(state.characters.claude.tokens, 54);
  // Codex：deep 后不回复，隔晚也不恢复。
  let codex = night(core.createState(), 'codex');
  assert.equal(codex.characters.codex.tokens, 64);
  codex = night(codex, 'claude');
  assert.equal(codex.characters.codex.tokens, 64);
  codex = night(codex, 'codex');
  assert.equal(codex.characters.codex.tokens, 38);
  assert.equal(core.preview(codex, 'codex', 'deep').allowed, true);
  const low = night(night(night(core.createState(), 'codex'), 'codex'), 'codex');
  assert.equal(low.characters.codex.tokens, 12);
  assert.equal(core.preview(low, 'codex', 'deep').allowed, false);
  assert.equal(core.preview(low, 'codex', 'shallow').allowed, true);
  // 解锁后的角色按各自 regen 恢复（Cursor +12、WorkBuddy +20），封顶 cap；未被选择的保持满额。
  let hidden = night(unlockedNightThree(), 'cursor');
  assert.equal(hidden.characters.cursor.tokens, 29 + 12);
  assert.equal(hidden.characters.workbuddy.tokens, 110);
  hidden = night(unlockedNightThree(), 'workbuddy', 'shallow');
  assert.equal(hidden.characters.workbuddy.tokens, 110, '100+20 截断到 110');
  hidden = night(unlockedNightThree(), 'workbuddy', 'deep');
  assert.equal(hidden.characters.workbuddy.tokens, 84 + 20);
  assert.deepEqual([1, 2, 3, 4].map((n) => core.capFor('claude', n)), [30, 38, 46, 54]);
  assert.deepEqual([1, 2, 3, 4].map((n) => core.capFor('codex', n)), [90, 90, 90, 90]);
});

test('select/talk/mode 三阶段可预览任意角色，所有角色模式与实际结算一致且无变更', () => {
  const keys = ['allowed', 'reason', 'cost', 'feed', 'drain', 'wasted', 'energyAfter', 'fatal', 'warning', 'tokensAfter', 'blockedNextNight', 'resetNextNight'];
  // 第一晚只有 Codex/Claude 可选；第三晚（Claude 休息）检查 Codex 与两位新角色。
  for (const initial of [freeze(core.createState()), freeze(unlockedNightThree())]) {
    const selectable = ids.filter((id) => core.preview(initial, id, 'shallow').allowed);
    assert.ok(selectable.length >= 2);
    for (const id of ids) for (const mode of modes) {
      const offer = core.preview(initial, id, mode);
      assert.deepEqual(Object.keys(offer).sort(), keys.slice().sort());
      assert.equal(offer.feed, Math.floor(offer.cost * core.constants.characters[id].nourish));
      assert.equal(offer.drain, core.drainFor(initial.night));
      assert.equal(offer.tokensAfter, initial.characters[id].tokens - offer.cost);
      const others = selectable.filter((other) => other !== id);
      const otherTalk = core.select(initial, others[0]);
      assert.deepEqual(core.preview(otherTalk, id, mode), offer);
      assert.deepEqual(core.preview(core.choose(otherTalk, 1), id, mode), offer);
      if (!selectable.includes(id)) {
        assert.equal(offer.allowed, false);
        immutableFailure(initial, () => core.select(initial, id));
        continue;
      }
      const talk = freeze(core.select(initial, id));
      const picked = freeze(core.choose(talk, 0));
      assert.deepEqual(core.preview(talk, id, mode), offer);
      assert.deepEqual(core.preview(picked, id, mode), offer);
      previewMatches(picked, mode);
    }
  }
  assert.deepEqual(core.createState(), contractState());
});

test('warning 阈值包含 10、排除 11；能量实际结算在 0 和 60 截断', () => {
  for (const [energy, expected, warning, fatal] of [[21, 11, false, false], [20, 10, true, false], [10, 0, true, true], [1, 0, true, true]]) {
    const state = ready(core.createState(), 'codex');
    state.energy = energy;
    const offer = core.preview(state, 'codex', 'shallow');
    assert.equal(offer.energyAfter, expected);
    assert.equal(Boolean(offer.warning), warning);
    assert.equal(offer.fatal, fatal);
    previewMatches(state, 'shallow');
  }
  const state = ready(night(core.createState(), 'codex', 'greedy'), 'claude');
  assert.equal(state.energy, 60);
  assert.equal(core.preview(state, 'claude', 'greedy').energyAfter, 60, '60+38-25 截断到 60');
  assert.equal(core.preview(state, 'claude', 'greedy').wasted, 13);
  assert.equal(previewMatches(state, 'greedy').energy, 60);
});

test('所有合法操作返回深拷贝，历史与 lastResult 不共享可变对象', () => {
  let state = core.createState();
  const operations = [(s) => core.select(s, 'codex'), (s) => core.choose(s, 0), (s) => core.commit(s, 'deep'), (s) => core.advance(s)];
  for (const operation of operations) {
    const before = copy(state);
    const after = operation(freeze(state));
    assert.notEqual(after, state);
    assert.notEqual(after.characters, state.characters);
    assert.notEqual(after.characters.codex, state.characters.codex);
    assert.notEqual(after.actions, state.actions);
    assert.notEqual(after.history, state.history);
    if (after.lastResult) {
      assert.notEqual(after.lastResult, state.lastResult);
      assert.notEqual(after.lastResult, after.history.at(-1));
    }
    assert.deepEqual(state, before);
    state = after;
  }
});

test('六个结局的所有操作前缀均可严格往返，包括各晚日常与结算阶段', () => {
  for (const route of Object.values(fixedRoutes)) {
    let state = roundTrip(freeze(core.createState()));
    for (const { id, choice, mode } of route) {
      state = roundTrip(freeze(core.select(state, id)));
      state = roundTrip(freeze(core.choose(state, choice)));
      state = roundTrip(freeze(core.commit(state, mode)));
      state = roundTrip(freeze(core.advance(state)));
    }
  }
  const envelope = JSON.parse(core.serialize(runRoute(core, fixedRoutes.codex)));
  assert.deepEqual(Object.keys(envelope).sort(), ['format', 'state']);
  assert.equal(envelope.format, 'four-nights-v4');
  assert.equal(envelope.state.version, 4);
});

test('字段顺序不影响重放，导入与 validateState 返回可独立修改的新状态', () => {
  const state = runRoute(core, fixedRoutes.cursor);
  const reorder = (value) => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
  assert.deepEqual(core.deserialize(JSON.stringify(reorder(JSON.parse(core.serialize(state))))), state);
  const loaded = roundTrip(freeze(state));
  loaded.characters.cursor.tokens = 0;
  loaded.history[0].cost = 0;
  assert.notEqual(loaded.characters.cursor.tokens, state.characters.cursor.tokens);
  assert.notEqual(loaded.history[0].cost, state.history[0].cost);
});

test('拒绝篡改所有派生状态、人物、历史、lastResult 与操作内容', () => {
  const baseline = runRoute(core, fixedRoutes.codex);
  const mutations = [
    (s) => { s.version = 3; }, (s) => { s.version = 5; }, (s) => { s.night = 3; }, (s) => { s.phase = 'result'; },
    (s) => { s.energy -= 1; }, (s) => { s.selected = 'claude'; }, (s) => { s.choice = 1; },
    (s) => { s.endingId = 'household'; }, (s) => { s.characters.codex.tokens += 1; },
    (s) => { s.characters.codex.cap += 1; }, (s) => { s.characters.codex.visits -= 1; },
    (s) => { s.characters.codex.affinity -= 1; }, (s) => { s.characters.codex.blockedNight = 2; },
    (s) => { s.characters.codex.resets = 1; }, (s) => { s.characters.codex.resets = 2; },
    (s) => { s.characters.claude.resets = 1; }, (s) => { s.characters.claude.cap = 46; },
    (s) => { s.characters.cursor.visits = 1; },
    (s) => { s.history.pop(); }, (s) => { s.lastResult = null; },
    (s) => { s.history[0].night = 2; }, (s) => { s.history[0].character = 'claude'; },
    (s) => { s.history[0].mode = 'shallow'; }, (s) => { s.history[0].choice = 1; },
    (s) => { s.history[0].cost = 25; }, (s) => { s.history[0].energyBefore = 27; },
    (s) => { s.history[0].feed = 25; }, (s) => { s.history[0].wasted = 1; }, (s) => { s.history[0].feed = 27; },
    (s) => { s.history[0].energyAfter = 33; }, (s) => { s.history[0].visit = 2; },
    (s) => { s.history[0].blockedNextNight = true; }, (s) => { s.history[0].resetNextNight = true; },
    (s) => { s.history[0].resetNextNight = 'true'; },
    (s) => { s.actions[0].id = 'cursor'; }, (s) => { s.actions[1].index = 1; },
    (s) => { s.actions[2].mode = 'greedy'; }, (s) => { s.actions.pop(); }
  ];
  for (const key of Object.keys(baseline.lastResult)) mutations.push((s) => {
    const changes = { night: 3, character: 'claude', mode: 'shallow', choice: 1, cost: 25, feed: 25, energyBefore: 1, energyAfter: 1, wasted: 1, visit: 1, blockedNextNight: true, resetNextNight: true };
    s.lastResult[key] = changes[key];
    assert.notEqual(s.lastResult[key], baseline.lastResult[key], key);
  });
  mutations.forEach((mutate, index) => {
    const state = copy(baseline);
    mutate(state);
    assert.throws(() => core.validateState(state), undefined, '派生状态篡改 ' + index);
    assert.throws(() => core.serialize(state));
    assert.throws(() => core.deserialize(JSON.stringify({ format: 'four-nights-v4', state })));
  });
});

test('拒绝各层未知或缺失字段、非法标量、容量越界和非有限数', () => {
  const baseline = JSON.parse(core.serialize(runRoute(core, fixedRoutes.codex)));
  const targets = (e) => [e, e.state, e.state.characters, e.state.characters.codex, e.state.history[0], e.state.lastResult, ...e.state.actions.slice(0, 4)];
  for (let index = 0; index < targets(baseline).length; index += 1) {
    for (const missing of [false, true]) {
      const envelope = copy(baseline);
      const target = targets(envelope)[index];
      if (missing) delete target[Object.keys(target)[0]];
      else target.extra = true;
      assert.throws(() => core.deserialize(JSON.stringify(envelope)));
    }
  }
  for (const value of [-1, 61, 101, 1.5, '28', null, false, NaN, Infinity, -Infinity]) {
    const state = core.createState();
    state.energy = value;
    assert.throws(() => core.validateState(state));
    assert.throws(() => core.serialize(state));
  }
  for (const id of ids) for (const value of [-1, core.capFor(id, 1) + 1, Infinity, NaN]) {
    const state = core.createState();
    state.characters[id].tokens = value;
    assert.throws(() => core.serialize(state));
  }
  const encoded = JSON.stringify(baseline);
  for (const literal of ['1e309', '-1e309', 'NaN']) {
    assert.throws(() => core.deserialize(encoded.replace(/"energy":\d+/, '"energy":' + literal)));
  }
  for (const value of ['', '{', 'null', '[]', '{}', 'true', '1', '"text"', null, baseline]) assert.throws(() => core.deserialize(value));
});

test('拒绝各层原型键、自定义原型、符号、访问器、隐藏字段与稀疏数组', () => {
  const baseline = JSON.parse(core.serialize(runRoute(core, fixedRoutes.codex)));
  const targets = (e) => [e, e.state, e.state.characters, e.state.characters.codex, e.state.history[0], e.state.lastResult, e.state.actions[0]];
  for (let index = 0; index < targets(baseline).length; index += 1) for (const key of ['__proto__', 'constructor', 'prototype']) {
    const envelope = copy(baseline);
    Object.defineProperty(targets(envelope)[index], key, { value: { polluted: true }, enumerable: true });
    assert.throws(() => core.deserialize(JSON.stringify(envelope)));
    assert.equal({}.polluted, undefined);
  }
  const mutations = [
    (s) => Object.setPrototypeOf(s, { polluted: true }),
    (s) => Object.setPrototypeOf(s.characters.codex, null),
    (s) => Object.setPrototypeOf(s.actions, {}),
    (s) => { s[Symbol('extra')] = 1; },
    (s) => Object.defineProperty(s, 'hidden', { value: 1 }),
    (s) => Object.defineProperty(s, 'energy', { get() { throw new Error('访问器不应执行'); }, enumerable: true }),
    (s) => Object.defineProperty(s.actions[0], 'type', { get() { throw new Error('访问器不应执行'); }, enumerable: true }),
    (s) => { delete s.actions[0]; }, (s) => { s.actions.extra = 1; },
    (s) => { s.actions[Symbol('extra')] = 1; }, (s) => { s.history.extra = 1; },
    (s) => { s.characters.codex.tokens = s; }, (s) => { s.actions[0] = s; }
  ];
  for (const mutate of mutations) {
    const state = copy(baseline.state);
    mutate(state);
    assert.throws(() => core.validateState(state), (error) => !/访问器不应执行/.test(error.message));
    assert.throws(() => core.serialize(state), (error) => !/访问器不应执行/.test(error.message));
  }
});

test('严格拒绝非法操作序列、超过 16 条操作及非白名单动作，不执行导入字符串', () => {
  const baseline = JSON.parse(core.serialize(runRoute(core, fixedRoutes.household)));
  const invalid = [
    [{ type: 'advance' }], [{ type: 'choose', index: 0 }], [{ type: 'commit', mode: 'deep' }],
    [{ type: 'select', id: 'codex' }, { type: 'select', id: 'claude' }],
    [{ type: 'select', id: 'codex' }, { type: 'commit', mode: 'deep' }],
    [{ type: 'select', id: '__proto__' }], [{ type: 'choose', index: 2 }],
    [{ type: 'commit', mode: 'rest' }], [{ type: 'reset' }],
    [{ type: 'select', id: 'cursor' }], [{ type: 'select', id: 'workbuddy' }],
    [{ type: 'select', id: 'codex' }, { type: 'choose', index: 0 }, { type: 'commit', mode: 'greedy' }, { type: 'advance' }, { type: 'select', id: 'cursor' }],
    [{ type: 'constructor' }], [{ type: 'globalThis.afterhoursImportExecuted = true' }],
    baseline.state.actions.concat({ type: 'advance' }), [], {}, [null]
  ];
  globalThis.afterhoursImportExecuted = false;
  try {
    for (const actions of invalid) {
      const envelope = copy(baseline);
      envelope.state.actions = actions;
      assert.throws(() => core.deserialize(JSON.stringify(envelope)));
    }
    assert.equal(globalThis.afterhoursImportExecuted, false);
  } finally { delete globalThis.afterhoursImportExecuted; }
  const state = ready(core.createState(), 'codex');
  state.actions = Array.from({ length: 16 }, () => ({ type: 'advance' }));
  immutableFailure(state, () => core.commit(state, 'deep'));
});

test('v1、v2、v3 旧 envelope 与旧 state 均明确拒绝，不自动迁移', () => {
  const old = /旧版存档与新规则不兼容/;
  const v2State = { version: 2, night: 1, phase: 'select', energy: 28, characters: {}, selected: null, choice: null, history: [], actions: [], lastResult: null, endingId: null };
  for (const envelope of [
    { version: 1, state: { version: 1, round: 0 } },
    { version: 2, format: 'four-nights-v2', state: v2State },
    { format: 'four-nights-v1', state: { version: 1 } },
    { format: 'four-nights-v2', state: { version: 1, round: 0 } },
    { format: 'four-nights-v2', state: v2State },
    { format: 'four-nights-v3', state: v2State },
    { format: 'four-nights-v3', state: { ...core.createState(), version: 2 } },
    { format: 'four-nights-v3', state: { ...core.createState(), version: 1 } },
    { format: 'four-nights-v3', state: { ...core.createState(), version: 3 } },
    { format: 'four-nights-v4', state: { ...core.createState(), version: 3 } },
    { version: 3, format: 'four-nights-v4', state: core.createState() }
  ]) assert.throws(() => core.deserialize(JSON.stringify(envelope)), old);
  for (const version of [1, 2, 3]) {
    for (const state of [{ version, round: 0 }, { ...core.createState(), version }]) {
      assert.throws(() => core.validateState(state), old);
      assert.throws(() => core.serialize(state), old);
    }
  }
  // 结构正确但 version 非 4 的状态同样拒绝。
  for (const version of [0, 5, '4', '3', null]) assert.throws(() => core.validateState({ ...core.createState(), version }), /版本|v4/);
  const envelope = JSON.parse(core.serialize(core.createState()));
  for (const format of ['unknown', 'four-nights-v3', 'four-nights-v2', 'four-nights-v1']) {
    envelope.format = format;
    assert.throws(() => core.deserialize(JSON.stringify(envelope)), /格式/);
  }
});

test('v4 逐晚夜耗 20/25/30/35：预览 drain 与 drainFor 一致，同样深补饱食逐晚下降', () => {
  const route = ['codex', 'claude', 'codex', 'claude'];
  let state = core.createState();
  const energies = [];
  for (let index = 0; index < 4; index += 1) {
    assert.equal(state.night, index + 1);
    for (const id of ['codex', 'claude']) for (const mode of modes) {
      assert.equal(core.preview(state, id, mode).drain, [20, 25, 30, 35][index]);
    }
    const offer = core.preview(ready(state, route[index]), route[index], 'deep');
    assert.equal(offer.drain, core.drainFor(state.night));
    assert.equal(offer.energyAfter, state.energy + 26 - offer.drain);
    state = previewMatches(ready(state, route[index]), 'deep');
    energies.push(state.energy);
    state = core.advance(state);
  }
  assert.deepEqual(energies, [34, 35, 31, 22]);
  assert.equal(state.endingId, 'claude', '两次真心回应 Claude，末晚也是她');
  // 非法阶段、角色或模式：drain 与 wasted 同 cost/feed 一样为 0。
  const ended = runRoute(core, fixedRoutes.household);
  for (const offer of [core.preview(ended, 'codex', 'deep'), core.preview(core.createState(), 'nobody', 'deep'), core.preview(core.createState(), 'codex', 'rest')]) {
    assert.equal(offer.allowed, false);
    assert.deepEqual([offer.cost, offer.feed, offer.drain, offer.wasted, offer.tokensAfter], [0, 0, 0, 0, null]);
  }
});

test('v4 饱食上限 60：超出部分记为 wasted 且不累积，恰好 60 时不浪费', () => {
  for (const [energy, mode, after, wasted] of [[54, 'deep', 60, 0], [55, 'deep', 60, 1], [60, 'shallow', 50, 0], [34, 'greedy', 60, 44]]) {
    const state = ready(core.createState(), 'codex');
    state.energy = energy;
    const offer = core.preview(state, 'codex', mode);
    assert.equal(offer.energyAfter, after, `${energy}+${offer.feed}-20`);
    assert.equal(offer.wasted, wasted);
    const settled = previewMatches(state, mode);
    assert.equal(settled.energy, after);
    assert.equal(settled.lastResult.wasted, wasted);
  }
  // 第一晚贪心 Codex 只能把饱食填到 60，之后三晚仍需 90 点夜耗，不再一口吃成胖子。
  let state = night(core.createState(), 'codex', 'greedy');
  assert.equal(state.energy, 60);
  assert.equal(state.history[0].wasted, 38);
  for (const expected of [45, 25, 0]) {
    state = result(state, 'claude', 'shallow');
    assert.equal(state.energy, expected);
    assert.equal(state.lastResult.wasted, 0);
    state = core.advance(state);
  }
  assert.equal(state.endingId, 'hunger', '贪心之后连着三晚浅尝仍会饿倒');
  roundTrip(state);
});

test('v4 WorkBuddy nourish 0.5 向下取整只顶一半饱，其他人 feed 等于 cost', () => {
  const base = unlockedNightThree();
  for (const [tokens, mode, feed] of [[110, 'shallow', 5], [110, 'deep', 13], [110, 'greedy', 55], [37, 'greedy', 18], [1, 'greedy', 0]]) {
    const state = ready(base, 'workbuddy');
    state.characters.workbuddy.tokens = tokens;
    const offer = core.preview(state, 'workbuddy', mode);
    assert.equal(offer.cost, mode === 'greedy' ? tokens : core.constants.costs[mode]);
    assert.equal(offer.feed, feed);
    assert.equal(offer.energyAfter, Math.max(0, Math.min(60, 60 + feed - 30)));
    assert.equal(previewMatches(state, mode).lastResult.feed, feed);
  }
  for (const id of ['codex', 'cursor']) for (const mode of modes) {
    const offer = core.preview(base, id, mode);
    assert.equal(offer.feed, offer.cost, id + ' nourish=1');
  }
  const settled = runRoute(core, fixedRoutes.workbuddy);
  assert.deepEqual(settled.history.slice(2).map((entry) => [entry.cost, entry.feed, entry.energyAfter]), [[26, 13, 43], [26, 13, 21]]);
  roundTrip(settled);
});

test('v4 拒绝真实 v3 存档：v3 envelope、v3 state 与缺 feed/wasted 的旧结算记录', () => {
  const message = '旧版存档与新规则不兼容，请重新开始。';
  const v3 = copy(runRoute(core, fixedRoutes.codex));
  v3.version = 3;
  for (const entry of [...v3.history, v3.lastResult]) { delete entry.feed; delete entry.wasted; }
  for (const format of ['four-nights-v3', 'four-nights-v4']) {
    assert.throws(() => core.deserialize(JSON.stringify({ format, state: v3 })), (error) => error.message === message);
  }
  assert.throws(() => core.validateState(v3), (error) => error.message === message);
  assert.throws(() => core.serialize(v3), (error) => error.message === message);
  // 即便把版本号改成 4，旧结算记录缺字段也不能混进来。
  const relabeled = { ...copy(v3), version: 4 };
  assert.throws(() => core.validateState(relabeled), /字段/);
  assert.throws(() => core.deserialize(JSON.stringify({ format: 'four-nights-v4', state: relabeled })), /字段/);
});

test('存档按真实 UTF-8 字节限制 128 KiB，不混淆中文或代理对的字符串长度', () => {
  const encoded = core.serialize(core.createState());
  const limit = 128 * 1024;
  const exact = encoded + ' '.repeat(limit - Buffer.byteLength(encoded, 'utf8'));
  assert.equal(Buffer.byteLength(exact, 'utf8'), limit);
  assert.deepEqual(core.deserialize(exact), core.createState());
  assert.throws(() => core.deserialize(exact + ' '), /128 KiB/);
  for (const text of ['汉'.repeat(44000), '\u00e9'.repeat(66000), '\uD83D\uDE00'.repeat(33000), '\uD800'.repeat(44000)]) {
    assert.ok(text.length <= limit);
    assert.ok(Buffer.byteLength(text, 'utf8') > limit);
    assert.throws(() => core.deserialize(text), /128 KiB/);
  }
});

test('六个结局夹具只通过四个公开操作生成，固定路线可复用且无旧剧情依赖', () => {
  assert.deepEqual(Object.keys(fixedRoutes).sort(), endings.slice().sort());
  const fixtures = generateFixtures();
  assert.deepEqual(Object.keys(fixtures).sort(), endings.slice().sort());
  for (const ending of endings) {
    const state = fixtures[ending];
    assert.equal(state.phase, 'ended');
    assert.equal(state.endingId, ending);
    assert.deepEqual(state, runRoute(core, fixedRoutes[ending]));
    assert.equal(state.actions.length, ending === 'hunger' ? 12 : 16);
    bounds(state);
    roundTrip(state);
  }
  assert.notEqual(generateFixtures().codex, fixtures.codex);
  assert.throws(() => runRoute(core, fixedRoutes.codex.slice(0, 3)), /尚未抵达/);
  assert.throws(() => runRoute(core, fixedRoutes.hunger.concat(fixedRoutes.hunger[0])), /结束后/);
});

test('结局仅看最后所选角色，visits>=2 与 affinity>=3 均必须满足', () => {
  for (const id of ids) {
    const route = fixedRoutes[id].map((entry) => ({ ...entry }));
    const visits = route.map((entry, index) => entry.id === id ? index : -1).filter((index) => index !== -1);
    assert.ok(visits.length >= 2);
    assert.equal(visits.at(-1), 3, id + ' 的固定路线必须以本人结束');
    for (const index of visits) route[index].choice = 1;
    const lowAffinity = runRoute(core, route);
    assert.equal(lowAffinity.characters[id].visits, visits.length);
    assert.equal(lowAffinity.characters[id].affinity, visits.length);
    assert.equal(lowAffinity.endingId, visits.length >= 3 ? id : 'household');
    route[visits[0]].choice = 0;
    const enough = runRoute(core, route);
    assert.equal(enough.characters[id].affinity, visits.length + 1);
    assert.equal(enough.endingId, id);
    route[3].mode = 'greedy';
    const finalGreedy = runRoute(core, route);
    assert.equal(finalGreedy.endingId, id);
    assert.equal(finalGreedy.characters[id].tokens, 0);
    // Codex 的第一次 greedy 只会消耗重置次数，不写入 blockedNight。
    const reset = core.constants.characters[id].resets > 0 && !route.slice(0, 3).some((entry) => entry.id === id && entry.mode === 'greedy');
    assert.equal(finalGreedy.lastResult.resetNextNight, reset);
    assert.equal(finalGreedy.characters[id].blockedNight, reset ? 0 : 5);
    roundTrip(finalGreedy);
  }
  // 只来访一次，即使选择 0 也不够；隐藏角色只能在第三、四晚来访。
  const newcomer = runRoute(core, ['codex', 'codex', 'codex', 'claude'].map((id) => ({ id, mode: 'deep', choice: 0 })));
  assert.equal(newcomer.characters.codex.visits, 3);
  assert.equal(newcomer.characters.codex.affinity, 6);
  assert.equal(newcomer.endingId, 'household');
  const late = runRoute(core, [
    { id: 'codex', mode: 'greedy', choice: 0 }, { id: 'claude', mode: 'greedy', choice: 0 },
    { id: 'codex', mode: 'deep', choice: 0 }, { id: 'cursor', mode: 'deep', choice: 0 }
  ]);
  assert.equal(late.characters.cursor.visits, 1);
  assert.equal(late.endingId, 'household');
  const split = runRoute(core, [
    { id: 'claude', mode: 'greedy', choice: 0 }, { id: 'codex', mode: 'greedy', choice: 0 },
    { id: 'workbuddy', mode: 'deep', choice: 1 }, { id: 'workbuddy', mode: 'shallow', choice: 0 }
  ]);
  assert.equal(split.characters.workbuddy.affinity, 3);
  assert.equal(split.endingId, 'workbuddy');
});

test('1000 条固定种子合法路线：全阶段存档、预览一致、容量边界与终局', (t) => {
  const random = rng(0x20260925);
  let commits = 0;
  let actions = 0;
  const reached = new Set();
  for (let game = 0; game < 1000; game += 1) {
    let state = core.createState();
    while (state.phase !== 'ended') {
      bounds(state);
      const options = legalOptions(core, freeze(state));
      assert.ok(options.length > 0);
      const { id, mode, offer } = options[Math.floor(random() * options.length)];
      state = roundTrip(freeze(core.select(state, id)));
      bounds(state);
      state = roundTrip(freeze(core.choose(state, random() < 0.5 ? 0 : 1)));
      bounds(state);
      assert.deepEqual(core.preview(state, id, mode), offer);
      state = roundTrip(freeze(previewMatches(state, mode)));
      bounds(state);
      commits += 1;
      state = roundTrip(freeze(core.advance(state)));
      bounds(state);
    }
    assert.ok(state.actions.length <= 16);
    assert.equal(state.endingId === 'hunger', state.energy === 0);
    if (state.energy > 0) {
      assert.equal(state.night, 4);
      const person = state.characters[state.selected];
      assert.equal(state.endingId, person.visits >= 2 && person.affinity >= 3 ? state.selected : 'household');
    }
    reached.add(state.endingId);
    actions += state.actions.length;
  }
  assert.ok(commits >= 3000 && commits <= 4000);
  assert.deepEqual([...reached].sort(), endings.slice().sort());
  t.diagnostic('已验证 1000 条固定种子路线，' + commits + ' 次结算、' + actions + ' 次合法状态操作，覆盖全部 6 个结局。');
});
