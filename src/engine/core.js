(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AfterhoursCore = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ids = Object.freeze(['codex', 'claude', 'cursor', 'workbuddy']);
  var modes = ['shallow', 'deep', 'greedy'];
  var phases = ['select', 'talk', 'mode', 'result', 'ended'];
  var format = 'four-nights-v4';
  var maxActions = 16;
  var maxBytes = 128 * 1024;
  // 规则 v4：饱食上限 60，吃不下的部分溢出浪费；零一晚比一晚饿，夜耗 20→25→30→35。
  // 角色额度随人设：
  // Codex 额度按周算，每晚不回复；第一次被榨干时官方发一次全局重置，次晚回满、不休息。
  // Claude 额度小但每晚回满，上限逐晚增加（持久性在变好）。
  // Cursor、WorkBuddy 要等 Codex 与 Claude 都被榨干过一次，零才会想起他们。
  // WorkBuddy 便宜大碗：额度多、回得快，但 nourish 0.5，只顶一半饱。
  var constants = freeze({
    nights: 4, initialEnergy: 28, maxEnergy: 60, drains: [20, 25, 30, 35],
    characters: {
      codex: { caps: [90, 90, 90, 90], regen: 0, resets: 1, hidden: false, nourish: 1 },
      claude: { caps: [30, 38, 46, 54], regen: 100, resets: 0, hidden: false, nourish: 1 },
      cursor: { caps: [55, 55, 55, 55], regen: 12, resets: 0, hidden: true, nourish: 1 },
      workbuddy: { caps: [110, 110, 110, 110], regen: 20, resets: 0, hidden: true, nourish: 0.5 }
    },
    unlockAfter: ['codex', 'claude'],
    costs: { shallow: 10, deep: 26 }
  });

  function freeze(value) {
    Object.keys(value).forEach(function (key) {
      if (value[key] && typeof value[key] === 'object') freeze(value[key]);
    });
    return Object.freeze(value);
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function characterId(id) { assert(ids.indexOf(id) !== -1, '角色无效。'); }
  function requirePhase(state, phase) { assert(state.phase === phase, '当前阶段不能执行此操作，需要 ' + phase + ' 阶段。'); }
  function capFor(id, night) { return constants.characters[id].caps[night - 1]; }
  function drainFor(night) { return constants.drains[night - 1]; }
  function maxCap(id) { return Math.max.apply(null, constants.characters[id].caps); }
  function withAction(state, action) {
    assert(state.actions.length < maxActions, '合法操作最多为 16 次。');
    var next = clone(state);
    next.actions.push(action);
    return next;
  }
  // 两位都被贪心榨干过一次以后，零才会注意到另外两个人。
  function unlocked(state) {
    return constants.unlockAfter.every(function (id) {
      return state.history.some(function (entry) { return entry.character === id && entry.mode === 'greedy'; });
    });
  }
  function hidden(state, id) { return constants.characters[id].hidden && !unlocked(state); }
  function resetAvailable(person, id) { return person.resets < constants.characters[id].resets; }

  function createState() {
    var characters = {};
    ids.forEach(function (id) {
      var cap = capFor(id, 1);
      characters[id] = { tokens: cap, cap: cap, visits: 0, affinity: 0, blockedNight: 0, resets: 0 };
    });
    return {
      version: 4, night: 1, phase: 'select', energy: constants.initialEnergy,
      characters: characters, selected: null, choice: null,
      history: [], actions: [], lastResult: null, endingId: null
    };
  }

  function select(state, id) {
    requirePhase(state, 'select');
    characterId(id);
    assert(!hidden(state, id), '零现在眼里只有 Codex 和 Claude。');
    assert(state.characters[id].blockedNight !== state.night, '该角色本晚暂停选择，下一晚恢复。');
    assert(state.characters[id].tokens > 0, '该角色没有可用 Token。');
    var next = withAction(state, { type: 'select', id: id });
    next.phase = 'talk';
    next.selected = id;
    return next;
  }

  function choose(state, index) {
    requirePhase(state, 'talk');
    assert(index === 0 || index === 1, '回应选项只能是 0 或 1。');
    var next = withAction(state, { type: 'choose', index: index });
    next.phase = 'mode';
    next.choice = index;
    return next;
  }

  function preview(state, id, mode) {
    var result = {
      allowed: false, reason: '', cost: 0, feed: 0, drain: 0, wasted: 0, energyAfter: state.energy,
      fatal: false, warning: '', tokensAfter: null, blockedNextNight: false, resetNextNight: false
    };
    if (['select', 'talk', 'mode'].indexOf(state.phase) === -1) {
      result.reason = '当前阶段不能预览，请先完成本晚结算。';
      return result;
    }
    if (ids.indexOf(id) === -1 || modes.indexOf(mode) === -1) {
      result.reason = '角色或模式无效。';
      return result;
    }
    var person = state.characters[id];
    result.cost = mode === 'greedy' ? person.tokens : constants.costs[mode];
    result.feed = Math.floor(result.cost * constants.characters[id].nourish);
    result.drain = drainFor(state.night);
    var raw = state.energy + result.feed - result.drain;
    result.energyAfter = clamp(raw, 0, constants.maxEnergy);
    result.wasted = Math.max(0, raw - constants.maxEnergy);
    result.fatal = result.energyAfter <= 0;
    result.warning = result.fatal ? '本次结算后饱食将归零，继续将进入饥饿结局，请再次确认。'
      : result.energyAfter <= 10 ? '本次结算后饱食偏低（不高于 10），请谨慎选择。' : '';
    result.tokensAfter = person.tokens - result.cost;
    result.resetNextNight = mode === 'greedy' && resetAvailable(person, id);
    result.blockedNextNight = mode === 'greedy' && !result.resetNextNight;
    if (hidden(state, id)) result.reason = '零现在眼里只有 Codex 和 Claude。';
    else if (person.blockedNight === state.night) result.reason = '该角色本晚暂停选择，下一晚恢复。';
    else if (person.tokens <= 0) result.reason = '该角色没有可用 Token。';
    else if (mode !== 'greedy' && person.tokens <= result.cost) result.reason = 'Token 必须大于固定消耗，只有贪心可以清零。';
    else result.allowed = true;
    return result;
  }

  function commit(state, mode) {
    requirePhase(state, 'mode');
    var offer = preview(state, state.selected, mode);
    assert(offer.allowed, offer.reason);
    var next = withAction(state, { type: 'commit', mode: mode });
    var person = next.characters[next.selected];
    person.tokens = mode === 'greedy' ? 0 : person.tokens - offer.cost;
    if (offer.resetNextNight) person.resets += 1;
    if (offer.blockedNextNight) person.blockedNight = next.night + 1;
    person.visits += 1;
    person.affinity += 1 + (next.choice === 0 ? 1 : 0);
    next.energy = offer.energyAfter;
    next.phase = 'result';
    next.lastResult = {
      night: next.night, character: next.selected, mode: mode, choice: next.choice,
      cost: offer.cost, feed: offer.feed, energyBefore: state.energy, energyAfter: next.energy,
      wasted: offer.wasted, visit: person.visits, blockedNextNight: offer.blockedNextNight, resetNextNight: offer.resetNextNight
    };
    next.history.push(clone(next.lastResult));
    return next;
  }

  function advance(state) {
    requirePhase(state, 'result');
    var next = withAction(state, { type: 'advance' });
    if (next.energy <= 0) {
      next.phase = 'ended';
      next.endingId = 'hunger';
    } else if (next.night === constants.nights) {
      var person = next.characters[next.selected];
      next.phase = 'ended';
      next.endingId = person.visits >= 2 && person.affinity >= 3 ? next.selected : 'household';
    } else {
      next.night += 1;
      ids.forEach(function (id) {
        var person = next.characters[id];
        person.cap = capFor(id, next.night);
        if (person.blockedNight === next.night) person.tokens = 0;
        else if (person.tokens === 0) person.tokens = person.cap;
        else person.tokens = Math.min(person.cap, person.tokens + constants.characters[id].regen);
      });
      next.phase = 'select';
      next.selected = null;
      next.choice = null;
    }
    return next;
  }

  var stateKeys = Object.keys(createState());
  var characterKeys = ['tokens', 'cap', 'visits', 'affinity', 'blockedNight', 'resets'];
  var resultKeys = ['night', 'character', 'mode', 'choice', 'cost', 'feed', 'energyBefore', 'energyAfter', 'wasted', 'visit', 'blockedNextNight', 'resetNextNight'];

  // 校验描述符而不是读取访问器，拒绝隐藏字段、符号键及原型污染键。
  function dataKeys(value, array) {
    return Reflect.ownKeys(value).map(function (key) {
      assert(typeof key === 'string' && ['__proto__', 'prototype', 'constructor'].indexOf(key) === -1, '存档包含原型键或符号键。');
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      assert(Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
        (descriptor.enumerable || (array && key === 'length')), '存档不能包含访问器或隐藏字段。');
      return key;
    });
  }
  function shape(value, keys) {
    assert(value !== null && typeof value === 'object' && !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype, '存档对象或原型结构无效。');
    var actual = dataKeys(value, false);
    assert(actual.length === keys.length && keys.every(function (key) {
      return actual.indexOf(key) !== -1;
    }), '存档字段不匹配，存在未知或缺失字段。');
  }
  function number(value, low, high) {
    assert(Number.isSafeInteger(value) && value >= low && value <= high, '存档包含非有限、非整数或越界数值。');
  }
  function list(value, max) {
    assert(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype, '存档列表或原型结构无效。');
    number(value.length, 0, max);
    var keys = dataKeys(value, true);
    assert(keys.length === value.length + 1 && keys.every(function (key) {
      return key === 'length' || (/^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length);
    }), '存档列表包含空洞或未知字段。');
  }
  function checkResult(value) {
    shape(value, resultKeys);
    number(value.night, 1, constants.nights);
    characterId(value.character);
    assert(modes.indexOf(value.mode) !== -1, '存档模式无效。');
    number(value.choice, 0, 1);
    number(value.cost, 1, maxCap(value.character));
    number(value.feed, 0, value.cost);
    number(value.energyBefore, 0, constants.maxEnergy);
    number(value.energyAfter, 0, constants.maxEnergy);
    number(value.wasted, 0, maxCap(value.character));
    number(value.visit, 1, constants.nights);
    assert(typeof value.blockedNextNight === 'boolean' && typeof value.resetNextNight === 'boolean', '存档锁定或重置标记无效。');
  }
  function checkAction(action) {
    assert(action !== null && typeof action === 'object', '存档操作无效。');
    var descriptor = Object.getOwnPropertyDescriptor(action, 'type');
    assert(descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value'), '存档操作类型无效。');
    switch (descriptor.value) {
      case 'select': shape(action, ['type', 'id']); characterId(action.id); break;
      case 'choose': shape(action, ['type', 'index']); number(action.index, 0, 1); break;
      case 'commit':
        shape(action, ['type', 'mode']);
        assert(modes.indexOf(action.mode) !== -1, '存档操作模式无效。');
        break;
      case 'advance': shape(action, ['type']); break;
      default: throw new Error('存档操作类型无效。');
    }
  }
  function same(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    var keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(function (key) {
      return Object.prototype.hasOwnProperty.call(b, key) && same(a[key], b[key]);
    });
  }
  function rejectOld(value) {
    if (value !== null && typeof value === 'object') {
      var descriptor = Object.getOwnPropertyDescriptor(value, 'version');
      assert(!descriptor || [1, 2, 3].indexOf(descriptor.value) === -1, '旧版存档与新规则不兼容，请重新开始。');
    }
  }
  function validateState(state) {
    rejectOld(state);
    shape(state, stateKeys);
    assert(state.version === 4, '不支持的存档版本，仅支持 v4。');
    number(state.night, 1, constants.nights);
    number(state.energy, 0, constants.maxEnergy);
    assert(phases.indexOf(state.phase) !== -1, '存档阶段无效。');
    assert(state.selected === null || ids.indexOf(state.selected) !== -1, '存档所选角色无效。');
    assert(state.choice === null || state.choice === 0 || state.choice === 1, '存档回应无效。');
    assert(state.endingId === null || ['hunger', 'household'].concat(ids).indexOf(state.endingId) !== -1, '存档结局无效。');
    shape(state.characters, ids);
    ids.forEach(function (id) {
      var person = state.characters[id];
      shape(person, characterKeys);
      assert(person.cap === capFor(id, state.night), '存档容量不匹配。');
      number(person.tokens, 0, person.cap);
      number(person.visits, 0, constants.nights);
      number(person.affinity, 0, constants.nights * 2);
      number(person.blockedNight, 0, constants.nights + 1);
      number(person.resets, 0, constants.characters[id].resets);
    });
    list(state.history, constants.nights);
    state.history.forEach(checkResult);
    if (state.lastResult !== null) checkResult(state.lastResult);
    list(state.actions, maxActions);
    state.actions.forEach(checkAction);

    // 只重放白名单操作，再比较所有派生字段，包括待选择、结果和结局阶段。
    var replay = createState();
    state.actions.forEach(function (action) {
      switch (action.type) {
        case 'select': replay = select(replay, action.id); break;
        case 'choose': replay = choose(replay, action.index); break;
        case 'commit': replay = commit(replay, action.mode); break;
        case 'advance': replay = advance(replay); break;
      }
    });
    assert(same(replay, state), '存档派生字段与合法操作重放不一致。');
    return clone(replay);
  }
  function serialize(state) {
    return JSON.stringify({ format: format, state: validateState(state) });
  }
  function byteLength(text) {
    var bytes = 0;
    for (var i = 0; i < text.length && bytes <= maxBytes; i += 1) {
      var code = text.charCodeAt(i);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xD800 && code <= 0xDBFF && text.charCodeAt(i + 1) >= 0xDC00 && text.charCodeAt(i + 1) <= 0xDFFF) {
        bytes += 4;
        i += 1;
      } else bytes += 3;
    }
    return bytes;
  }
  function deserialize(text) {
    assert(typeof text === 'string' && text.length > 0 && text.length <= maxBytes && byteLength(text) <= maxBytes,
      '存档必须是 UTF-8 字节大小不超过 128 KiB 的 JSON 文本。');
    var envelope;
    try { envelope = JSON.parse(text); } catch (_) { throw new Error('存档不是有效 JSON。'); }
    rejectOld(envelope);
    shape(envelope, ['format', 'state']);
    rejectOld(envelope.state);
    assert(envelope.format === format, '不支持的存档格式，仅支持 ' + format + '；旧版存档无法导入。');
    return validateState(envelope.state);
  }

  return Object.freeze({
    constants: constants, ids: ids, createState: createState, select: select, choose: choose,
    preview: preview, commit: commit, advance: advance, serialize: serialize,
    deserialize: deserialize, validateState: validateState, unlocked: unlocked, capFor: capFor,
    drainFor: drainFor
  });
}));
