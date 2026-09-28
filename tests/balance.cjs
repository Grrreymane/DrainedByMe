'use strict';

const core = require('../src/engine/core.js');
const ids = core.ids;
const endings = Object.freeze(['hunger', 'household', ...ids]);
const modes = Object.freeze(['shallow', 'deep', 'greedy']);

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function legalOptions(engine, state) {
  const candidates = state.phase === 'select' ? ids : [state.selected];
  return candidates.flatMap((id) => modes.map((mode) => ({
    id, mode, offer: engine.preview(state, id, mode)
  }))).filter((option) => option.offer.allowed);
}

// 每个条目代表一晚；固定路线只描述输入，不直接构造派生状态。
// 规则 v4 下的饱食轨迹（上限 60，夜耗 20/25/30/35）：
//   hunger 18→3→0；household/codex/claude 34→35→31→22；
//   cursor 60(溢出38)→60(溢出13)→56→47；workbuddy 60→60→43→21（WorkBuddy 深补只吸到 13）。
const row = (id, mode = 'deep', choice = 0) => ({ id, choice, mode });
// Cursor 与 WorkBuddy 要等 Codex、Claude 都被 greedy 过才会出现，最早第三晚来访。
const unlockPrefix = [row('codex', 'greedy'), row('claude', 'greedy')];
const fixedRoutes = {
  hunger: Array.from({ length: 3 }, () => row('codex', 'shallow')),
  // 最后所选 Claude 来访两次但亲密度只有 2，落入普通结局。
  household: [row('codex'), row('claude', 'deep', 1), row('codex'), row('claude', 'deep', 1)],
  codex: [row('codex'), row('claude'), row('claude'), row('codex')],
  claude: [row('claude'), row('codex'), row('codex'), row('claude')],
  cursor: [...unlockPrefix, row('cursor'), row('cursor')],
  workbuddy: [...unlockPrefix, row('workbuddy'), row('workbuddy')]
};
const demoRoute = fixedRoutes.household;
for (const route of Object.values(fixedRoutes)) {
  route.forEach(Object.freeze);
  Object.freeze(route);
}
Object.freeze(fixedRoutes);

function runRoute(engine, route) {
  let state = engine.createState();
  for (const { id, choice, mode } of route) {
    if (state.phase === 'ended') throw new Error('固定路线在结束后仍包含操作。');
    state = engine.select(state, id);
    state = engine.choose(state, choice);
    state = engine.commit(state, mode);
    state = engine.advance(state);
  }
  if (state.phase !== 'ended') throw new Error('固定路线尚未抵达结局。');
  return state;
}

function generateFixtures(engine = core) {
  return Object.fromEntries(endings.map((ending) => {
    const state = runRoute(engine, fixedRoutes[ending]);
    if (state.endingId !== ending) throw new Error('固定路线未抵达预期结局：' + ending);
    return [ending, engine.validateState(state)];
  }));
}

module.exports = { core, ids, endings, modes, fixedRoutes, demoRoute, runRoute, generateFixtures, legalOptions, rng };

if (require.main === module) {
  const fixtures = Object.fromEntries(Object.entries(generateFixtures()).map(([ending, state]) => [
    ending, JSON.parse(core.serialize(state))
  ]));
  console.log(JSON.stringify({ routes: fixedRoutes, fixtures }, null, 2));
}
