(function boot() {
  'use strict';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
    return;
  }

  const C = window.AfterhoursCore;
  const D = window.AfterhoursStory;
  const ids = ['codex', 'claude', 'cursor', 'workbuddy'];
  const modes = ['shallow', 'deep', 'greedy'];
  const modeNames = { shallow: '浅尝', deep: '深补', greedy: '贪心' };
  const title = '完蛋，我被 Agent 包围了';
  const namespace = 'token-four-nights-v4';
  const legacyCollectionKey = 'token-four-nights-v3.collection';
  const maxBytes = 128 * 1024;
  const maxReads = 12000;
  const root = document.getElementById('app');
  const dialog = document.getElementById('game-dialog');
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const readingPhases = ['intro', 'common', 'visit', 'reply', 'supplement', 'morning', 'ending'];
  const phaseNames = { intro: '初次见面', common: '夜晚的开场', select: '今晚，想和谁说话', visit: '两个人的片刻', choice: '轮到你说了', reply: '话音落下', mode: '把需要说清楚', supplement: '灯下的片刻', morning: '夜晚之后', ending: '故事的后记' };
  const cgKeys = ids.flatMap(id => modes.map(mode => id + '_' + mode));
  const endingIds = ['hunger', 'household', ...ids];
  const offstage = 'offstage';
  const failedAssets = new Set();
  const narrow = () => matchMedia('(max-width: 1000px)').matches;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state = null;
  let view = { phase: 'intro', cursor: 0, readCount: 0 };
  let onCover = true;
  let uiHidden = false;
  let storageOK = true;
  let collection = [];
  let endingsSeen = [];
  let readLines = new Set();
  let pendingMode = null;
  let returnSelector = null;
  let toastTimer;
  let renderVersion = 0;
  let lastPhaseKey = null;
  let lastGuardKey = null;
  let lastVisualKey = '';
  let lastCharacterKey = '';
  let freshEnding = null;
  let retryOpen = false;
  let autoOn = false;
  let autoTimer;
  // 触屏连点保护：阶段切换或弹窗刚出现的一小段时间里，手指落在新出现的选项上不算数。鼠标与键盘不受影响。
  let lastPointer = 'mouse';
  let tapGuardUntil = 0;
  const cgObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) unlockVisibleCG(entry.target); });
  }, { threshold: 0.1 });

  function checkStory() {
    assert(C && ['createState', 'select', 'choose', 'preview', 'commit', 'advance', 'serialize', 'deserialize', 'validateState', 'drainFor'].every(key => typeof C[key] === 'function') && C.constants.nights === 4, '规则文件尚未就绪，需要 v4 接口。');
    const text = value => typeof value === 'string' && value.trim().length > 0;
    function lines(value, label, empty = false) {
      assert(Array.isArray(value) && (empty || value.length > 0) && value.every(line => line && text(line.speaker) && text(line.text)), '剧情接口缺失或无效：' + label);
    }
    assert(D && text(D.title), '剧情文件尚未就绪，需要四晚 Story schema（title / nights / routes）。');
    lines(D.intro, 'intro');
    assert(Array.isArray(D.nights) && D.nights.length === 4, '剧情 nights 必须有四晚。');
    D.nights.forEach((night, index) => { assert(text(night.title), '夜晚标题缺失。'); lines(night.common, 'nights[' + index + '].common'); });
    ids.forEach(id => {
      const person = D.characters?.[id];
      assert(person && Number.isInteger(person.age) && person.age >= 18 && ['name', 'gender', 'animal', 'color', 'role', 'tagline', 'bio', 'art'].every(key => text(person[key])), id + ' 的成年角色资料不完整。');
      const routes = D.routes?.[id];
      // 零要先榨干 Codex 与 Claude 才会想起另外两人，他们最多只剩两晚可以来访。
      const visits = C.constants.characters[id].hidden ? 2 : 4;
      assert(Array.isArray(routes) && routes.length >= visits, id + ' 至少需要 ' + visits + ' 次来访剧情。');
      routes.forEach((route, index) => {
        assert(text(route.title), id + ' 的来访标题缺失。');
        lines(route.lines, id + '.routes[' + index + '].lines');
        assert(Array.isArray(route.choices) && route.choices.length === 2, id + ' 的来访必须有两个回应。');
        route.choices.forEach(choice => { assert(text(choice.label), '回应标题缺失。'); lines(choice.reply, id + '.reply'); });
      });
      ['supplements', 'repeatSupplements', 'morning'].forEach(group => modes.forEach(mode => lines(D[group]?.[id]?.[mode], group + '.' + id + '.' + mode)));
      ['consecutive', 'afterGreedy', 'switched'].forEach(kind => lines(D.returnLines?.[id]?.[kind], 'returnLines.' + id + '.' + kind, true));
      modes.forEach(mode => assert(D.cgMap?.[id]?.[mode] === id + '_' + mode, 'CG 映射必须使用 ' + id + '_' + mode));
    });
    lines(D.openings?.codexReset, 'openings.codexReset');
    lines(D.openings?.unlock, 'openings.unlock');
    ids.forEach(id => lines(D.openings?.after?.[id], 'openings.after.' + id));
    ['hunger', 'household', ...ids].forEach(id => {
      const ending = D.endings?.[id];
      assert(ending && text(ending.title) && text(ending.subtitle), '结局资料缺失：' + id);
      lines(ending.lines, 'endings.' + id);
    });
  }
  let schemaError = '';
  try { checkStory(); } catch (error) { schemaError = error.message; }

  function assetURL(key) {
    const mapped = window.AfterhoursAssets?.[key];
    // 仅使用打包的 data 图像或本地相对资源，不发起外部资源请求。
    if (typeof mapped === 'string' && (/^data:image\/(?:webp|png|jpeg|gif|svg\+xml)[;,]/i.test(mapped) || /^(?:\.\/)?src\/assets\/[a-z0-9_./-]+\.(?:webp|png|jpg|jpeg)$/i.test(mapped))) return mapped;
    return 'src/assets/' + key + '.webp';
  }
  function image(key, className, alt, fallback = '') {
    const actual = failedAssets.has(key) && fallback ? fallback : key;
    return '<img class="' + className + '" data-asset="' + esc(actual) + '"' + (fallback && actual === key ? ' data-fallback="' + esc(fallback) + '"' : '') + ' src="' + esc(assetURL(actual)) + '" alt="' + esc(alt) + '" draggable="false">';
  }
  function readStorage(key) {
    try { return localStorage.getItem(namespace + '.' + key); }
    catch (_) { storageOK = false; return null; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(namespace + '.' + key, value); return true; }
    catch (_) { storageOK = false; return false; }
  }
  // 收藏与数值规则无关：v4 还没有收藏记录时，只读沿用 v3 命名空间里已解锁的事件图，不改动旧记录。
  function legacyCollection() {
    try { return localStorage.getItem(legacyCollectionKey); }
    catch (_) { return null; }
  }
  function legacyAuto() {
    try { return Boolean(localStorage.getItem('token-four-nights-v3.auto')); }
    catch (_) { return false; }
  }
  try {
    const saved = JSON.parse(readStorage('collection') || legacyCollection() || 'null');
    if (saved?.version === 2 && Array.isArray(saved.cgs)) collection = [...new Set(saved.cgs.filter(key => cgKeys.includes(key)))];
  } catch (_) { /* 损坏的收藏记录不阻止阅读，也不覆盖旧记录。 */ }
  // 已见结局与已读对白只是阅读便利，和存档、收藏分开保存；损坏时当作空白。
  try {
    const saved = JSON.parse(readStorage('endings') || 'null');
    if (saved?.version === 1 && Array.isArray(saved.endings)) endingsSeen = [...new Set(saved.endings.filter(id => endingIds.includes(id)))];
  } catch (_) { /* 忽略 */ }
  try {
    const saved = JSON.parse(readStorage('read') || 'null');
    if (saved?.version === 1 && Array.isArray(saved.lines)) readLines = new Set(saved.lines.filter(item => typeof item === 'string' && item.length <= 12).slice(0, 6000));
  } catch (_) { /* 忽略 */ }
  function lineHash(line) {
    const text = line.speaker + '|' + line.text;
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
    return (hash >>> 0).toString(36);
  }
  function markRead(line) {
    const key = lineHash(line);
    if (readLines.has(key)) return;
    readLines.add(key);
    writeStorage('read', JSON.stringify({ version: 1, lines: [...readLines].slice(-6000) }));
  }
  function noteEnding(id) {
    if (endingsSeen.includes(id)) return;
    endingsSeen = [...endingsSeen, id];
    writeStorage('endings', JSON.stringify({ version: 1, endings: endingsSeen }));
  }

  function notify(text) {
    const box = document.getElementById('toast');
    // 提示放在顶层（popover）：弹窗打开时也看得见。每次重新 show，让它排到最新打开的弹窗之上。
    if (typeof box.showPopover === 'function') {
      try { if (box.matches(':popover-open')) box.hidePopover(); box.showPopover(); } catch (_) { /* 不支持 popover 时沿用普通定位。 */ }
    }
    box.textContent = text;
    box.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('visible'), 4200);
  }
  // 旁白（零的第一人称叙述）不挂名签；零说出口的引号句挂「零」；室友用各自的颜色。
  function speakerName(line) {
    if (!line) return '';
    if (line.speaker === 'narrator') return /^[“"「]/.test(line.text) ? '零' : '';
    if (line.speaker === 'player') return '零';
    return D.characters?.[line.speaker]?.name || line.speaker;
  }
  function speakerTag(line, extra = '') {
    const name = speakerName(line);
    if (!name) return '';
    const color = D.characters?.[line.speaker]?.color;
    return '<span class="speaker-name' + (color ? ' is-person' : ' is-zero') + extra + '"' + (color ? ' data-speaker="' + esc(line.speaker) + '" style="--speaker:' + esc(color) + '"' : '') + '>' + esc(name) + '</span>';
  }
  // 数字与斜杠之间用不换行空格，「1 / 2」「110 / 110」不会被拆成两行；放不下时 overflow-wrap 仍可断开，不会溢出。
  function pair(a, b) { return a + '\u00a0/\u00a0' + b; }
  function pronoun(id) { return D.characters[id]?.gender === '男' ? '他' : '她'; }
  function greedied(game, id) { return game.history.some(entry => entry.character === id && entry.mode === 'greedy'); }
  function unlockDone(game) { return C.constants.unlockAfter.filter(id => greedied(game, id)).length; }
  function justUnlocked(game) { return C.unlocked(game) && !C.unlocked({ history: game.history.slice(0, -1) }); }
  function routeFor(game) {
    return D.routes[game.selected][game.characters[game.selected].visits];
  }
  function visitLines(game) {
    const previous = game.history.filter(entry => entry.character === game.selected).at(-1);
    let greeting = [];
    if (previous) {
      const kind = previous.mode === 'greedy' && game.night >= previous.night + 2 ? 'afterGreedy'
        : previous.night === game.night - 1 ? 'consecutive' : 'switched';
      greeting = D.returnLines[game.selected][kind];
    }
    return [...greeting, ...routeFor(game).lines];
  }
  // 新一晚开场：先是别人对前一晚的反应（及 Codex 首次被榨干后的全局重置），再是当天的白天；
  // 零第一次想起另外两人的「那天晚上」放在最后，紧接着名册里的两人亮起来。
  function openingLines(game) {
    const last = game.history.at(-1);
    if (!last || game.night === 1) return [];
    const rows = [...D.openings.after[last.character]];
    if (last.character === 'codex' && last.resetNextNight) rows.push(...D.openings.codexReset);
    return rows;
  }
  function unlockLines(game) {
    return game.night > 1 && game.history.length && justUnlocked(game) ? D.openings.unlock : [];
  }
  function readingLines(game, phase) {
    if (phase === 'intro') return D.intro;
    if (phase === 'common') return [...openingLines(game), ...D.nights[game.night - 1].common, ...unlockLines(game)];
    if (phase === 'visit') return visitLines(game);
    if (phase === 'reply') return routeFor(game).choices[game.choice].reply;
    if (phase === 'ending') return D.endings[game.endingId].lines;
    if (phase === 'supplement' || phase === 'morning') {
      const result = game.lastResult;
      if (result.energyAfter <= 0) {
        return phase === 'supplement'
          ? [{ speaker: 'narrator', text: '补给没有抵过这一晚的消耗。我依旧很饿，连抬头说话的力气也在变轻。' }, { speaker: result.character, text: '“先别勉强说话。”对方在桌边停下来，没有把这次补给当作平安无事。' }]
          : [{ speaker: 'narrator', text: '灯还亮着，我的轮廓却越来越淡。这是我没能得到足够补给的夜晚，并不意味着其他人的额度都已用尽。' }];
      }
      if (phase === 'morning') return D.morning[result.character][result.mode];
      // history 已含当前 commit，重复判定只看更早的晚上。
      const repeated = game.history.some(entry => entry.night < result.night && entry.character === result.character && entry.mode === result.mode);
      return D[repeated ? 'repeatSupplements' : 'supplements'][result.character][result.mode];
    }
    return [];
  }
  function initialView() { return { phase: 'intro', cursor: 0, readCount: 0 }; }
  function nextView(game, current) {
    assert(readingPhases.includes(current.phase), '当前需要先做选择。');
    const length = readingLines(game, current.phase).length;
    assert(current.cursor < length, '本段已经读完。');
    const next = { ...current, readCount: current.readCount + 1 };
    if (current.cursor + 1 < length || ['morning', 'ending'].includes(current.phase)) next.cursor += 1;
    else {
      next.phase = { intro: 'common', common: 'select', visit: 'choice', reply: 'mode', supplement: 'morning' }[current.phase];
      next.cursor = 0;
    }
    return next;
  }
  function afterAction(current, phase) { return { phase, cursor: 0, readCount: current.readCount }; }
  function shape(value, keys, label) {
    assert(value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype, label + '结构无效。');
    const own = Reflect.ownKeys(value);
    assert(own.length === keys.length && own.every(key => typeof key === 'string' && keys.includes(key) && Object.getOwnPropertyDescriptor(value, key).enumerable && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')), label + '存在缺失、未知或访问器字段。');
  }

  // 阅读计数与合法动作一起重放：只改 phase/cursor 不能谎报已读完前置对白。
  // 不接受外部 backlog；回看完全从本地剧情与已验证的阅读边界重建。
  function replayView(game, target, collect = false) {
    shape(target, ['phase', 'cursor', 'readCount'], '阅读位置');
    const compatible = { select: ['intro', 'common', 'select'], talk: ['visit', 'choice'], mode: ['reply', 'mode'], result: ['supplement', 'morning'], ended: ['ending'] };
    assert(compatible[game.phase]?.includes(target.phase), '剧情阶段与 core phase 不相容。');
    assert(Number.isSafeInteger(target.cursor) && target.cursor >= 0 && Number.isSafeInteger(target.readCount) && target.readCount >= 0 && target.readCount <= maxReads, '阅读游标或计数无效。');
    if (target.phase === 'intro') assert(game.night === 1 && game.actions.length === 0, '序章只能出现在初始状态。');
    const length = readingLines(game, target.phase).length;
    const maximum = ['morning', 'ending'].includes(target.phase) ? length : Math.max(0, length - 1);
    assert(target.cursor <= maximum && (readingPhases.includes(target.phase) || target.cursor === 0), '阅读游标超出本段范围。');
    let replay = C.createState();
    let position = initialView();
    const rows = [];
    function note() {
      if (!collect) return;
      const line = readingLines(replay, position.phase)[position.cursor];
      if (line) rows.push({ night: replay.night, phase: position.phase, speaker: line.speaker, text: line.text });
    }
    function step() {
      assert(position.readCount < target.readCount, '阅读记录不足，不能跳过前置对白。');
      position = nextView(replay, position);
      note();
    }
    note();
    game.actions.forEach(action => {
      const required = { select: 'select', choose: 'choice', commit: 'mode', advance: 'morning' }[action.type];
      while (position.phase !== required || (action.type === 'advance' && position.cursor !== readingLines(replay, 'morning').length)) step();
      if (action.type === 'select') {
        replay = C.select(replay, action.id);
        position = afterAction(position, 'visit');
      } else if (action.type === 'choose') {
        if (collect) rows.push({ night: replay.night, phase: 'choice', speaker: 'player', text: routeFor(replay).choices[action.index].label });
        replay = C.choose(replay, action.index);
        position = afterAction(position, 'reply');
      } else if (action.type === 'commit') {
        replay = C.commit(replay, action.mode);
        position = afterAction(position, 'supplement');
      } else {
        replay = C.advance(replay);
        position = afterAction(position, replay.phase === 'ended' ? 'ending' : 'common');
      }
      note();
    });
    while (position.readCount < target.readCount) step();
    assert(position.phase === target.phase && position.cursor === target.cursor, '阅读阶段、游标和已读记录不一致。');
    return rows;
  }
  function validateView(game, candidate) {
    assert(!schemaError, schemaError);
    const valid = C.validateState(game);
    replayView(valid, candidate);
    return true;
  }
  function makePack() {
    assert(state, '开始故事后才能保存。');
    return JSON.stringify({ format: namespace, version: 4, savedAt: new Date().toISOString(), engine: C.serialize(state), ui: clone(view) });
  }
  function parsePack(text) {
    assert(!schemaError, schemaError);
    assert(typeof text === 'string' && text.length > 0 && text.length <= maxBytes && new TextEncoder().encode(text).byteLength <= maxBytes, '完整存档文件须不超过 128 KiB。');
    const pack = JSON.parse(text);
    shape(pack, ['format', 'version', 'savedAt', 'engine', 'ui'], '存档');
    assert(pack.format === namespace && pack.version === 4, '仅支持 v4 界面存档；旧版存档与新规则不兼容，请重新开始，旧档不会被覆盖。');
    assert(typeof pack.savedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(pack.savedAt) && Number.isFinite(Date.parse(pack.savedAt)), '存档时间无效。');
    assert(typeof pack.engine === 'string', '存档缺少引擎序列化文本。');
    const restored = C.deserialize(pack.engine);
    replayView(restored, pack.ui);
    return { state: restored, view: clone(pack.ui), savedAt: pack.savedAt };
  }
  function saveInfo(key) {
    const raw = readStorage(key);
    if (!raw) return null;
    try { return parsePack(raw); } catch (_) { return { damaged: true }; }
  }
  function autoSave() {
    if (!state) return;
    try { writeStorage('auto', makePack()); }
    catch (error) { notify('自动保存未完成：' + error.message); }
  }
  function commitUI(nextState, nextPosition) {
    // 先校验再同时替换，异常不会使引擎和阅读状态分离。
    validateView(nextState, nextPosition);
    state = nextState;
    view = nextPosition;
    onCover = false;
    autoSave();
    checkpoint();
    if (view.phase === 'ending' && view.cursor === readingLines(state, 'ending').length) {
      // 记下这是不是第一次见到的结局，结尾卡片上盖一个「新结局」。
      if (!endingsSeen.includes(state.endingId)) freshEnding = state.endingId;
      noteEnding(state.endingId);
    }
    render();
  }
  function loadPack(text) {
    const parsed = parsePack(text);
    stopAuto();
    freshEnding = null;
    retryOpen = false;
    state = parsed.state;
    view = parsed.view;
    onCover = false;
    autoSave();
    render();
    closeModal();
  }
  function startNew() {
    assert(!schemaError, schemaError);
    stopAuto();
    freshEnding = null;
    retryOpen = false;
    commitUI(C.createState(), initialView());
    closeModal();
  }
  function requestNew() {
    const saved = saveInfo('auto');
    if (saved && !saved.damaged && saved.state.phase !== 'ended') {
      openModal('开始新游戏？', '<p>当前这一局（第 ' + saved.state.night + ' 晚）会被新的一局替换。三份手动档、相册和已见结局都会留着。</p><div class="modal-actions"><button data-action="close-dialog">先不开始</button><button class="primary" data-action="confirm-new">开始新的四晚</button></div>');
    } else startNew();
  }
  function nextLine() {
    if (onCover || !state || uiHidden || dialog.open || !readingPhases.includes(view.phase)) return;
    if (view.cursor >= readingLines(state, view.phase).length) return;
    commitUI(state, nextView(state, view));
  }
  // 跳过已读：沿合法阅读路径一句句前进，停在第一句没读过的话、选项、补给选择或一晚结尾；
  // 只提交一次，已读计数照常累加，存档重放不受影响。补给 CG 还没收进相册时不跳过它。
  function skipTarget() {
    if (onCover || !state || !readingPhases.includes(view.phase)) return null;
    if (view.cursor >= readingLines(state, view.phase).length) return null;
    let next = nextView(state, view);
    let steps = 1;
    while (steps < 600 && readingPhases.includes(next.phase)) {
      const lines = readingLines(state, next.phase);
      if (next.cursor >= lines.length || !readLines.has(lineHash(lines[next.cursor]))) break;
      next = nextView(state, next);
      steps += 1;
    }
    return steps > 1 ? next : null;
  }
  function skipRead() {
    if (uiHidden || dialog.open) return;
    const scene = root.querySelector('img.event-art');
    if (scene) unlockVisibleCG(scene);
    const target = skipTarget();
    if (!target) return notify('后面没有读过的对白可以跳过。');
    commitUI(state, target);
  }
  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (!autoOn || onCover || !state || uiHidden || dialog.open || !readingPhases.includes(view.phase)) return;
    const line = readingLines(state, view.phase)[view.cursor];
    if (!line) return;
    const version = renderVersion;
    autoTimer = setTimeout(() => {
      if (!autoOn || version !== renderVersion) return;
      try { nextLine(); } catch (error) { autoOn = false; notify('自动播放已停止：' + error.message); render(); }
    // 约每分钟 500 字的阅读速度，长句不会被切走；最长停 18 秒。
    }, Math.min(18000, 1500 + 120 * Array.from(line.text).length));
  }
  function toggleAuto() {
    if (onCover || !state) return;
    autoOn = !autoOn;
    const button = root.querySelector('[data-action="toggle-auto"]');
    if (button) {
      button.setAttribute('aria-pressed', String(autoOn));
      button.classList.toggle('is-on', autoOn);
    }
    scheduleAuto();
  }
  function stopAuto() {
    autoOn = false;
    clearTimeout(autoTimer);
  }
  // 每晚进入选人时留一份检查点，后记里可以直接回到这一晚重选，不必从序章读起。
  function checkpoint() {
    if (!state || view.phase !== 'select') return;
    try { writeStorage('night' + state.night, makePack()); } catch (_) { /* 检查点只是便利，失败不打断阅读。 */ }
  }
  // 每一晚的检查点都可以回去：只认这一局走过的路（检查点的操作是当前操作的前缀）。
  function retryInfo(night) {
    if (!state || state.phase !== 'ended' || !Number.isInteger(night) || night < 1 || night > state.night) return null;
    const saved = saveInfo('night' + night);
    if (!saved || saved.damaged || saved.state.night !== night) return null;
    const prefix = saved.state.actions;
    return JSON.stringify(prefix) === JSON.stringify(state.actions.slice(0, prefix.length)) ? saved : null;
  }
  function retryNight(night) {
    const saved = retryInfo(night);
    if (!saved) return notify('没有找到这一局第 ' + night + ' 晚的检查点。');
    stopAuto();
    loadPack(readStorage('night' + night));
    notify('回到第 ' + night + ' 晚，重新选一次。');
  }
  function selectPerson(id) {
    if (onCover || view.phase !== 'select' || !ids.includes(id)) return;
    commitUI(C.select(state, id), afterAction(view, 'visit'));
  }
  function choose(index) {
    if (onCover || view.phase !== 'choice' || ![0, 1].includes(index)) return;
    commitUI(C.choose(state, index), afterAction(view, 'reply'));
  }
  // 只在真的有后果时说「休息」；第三晚吸空意味着这一局再也见不到对方，要直说。
  function restDescription(offer) {
    const who = pronoun(state.selected);
    if (offer.resetNextNight) return '官方会发一次全局重置：明晚' + who + '回满，不用休息。只有这一次。';
    if (!offer.blockedNextNight || state.night === 4) return '';
    if (state.night === 3) return '明晚是最后一晚，' + who + '要休息，这一局见不到了。';
    return '明晚' + who + '要休息，第 ' + (state.night + 2) + ' 晚恢复。';
  }
  // 还没解锁另外两人时，吸空 Codex / Claude 就是推进的一步，卡片与确认框都要说出来。
  function unlockHint(mode) {
    const id = state.selected;
    if (mode !== 'greedy' || C.unlocked(state) || !C.constants.unlockAfter.includes(id) || greedied(state, id)) return '';
    return '吸空' + pronoun(id) + '，零会开始注意屋里的其他人（' + pair(unlockDone(state) + 1, C.constants.unlockAfter.length) + '）';
  }
  // 每个人的补给特点，在选人时就写出来（选人不能反悔）。只读常量与当前状态。
  function traitFor(id) {
    const rules = C.constants.characters[id];
    // 最后一晚不再有「明晚」：回复与重置都不重要了，只留会影响今晚的「只顶一半饱」。
    const last = state.night >= C.constants.nights;
    const parts = last ? [] : [rules.regen >= 100 ? '每晚回满' : rules.regen > 0 ? '每晚回 ' + rules.regen : '每晚不回'];
    if (!last && state.characters[id].resets < rules.resets) parts.push('第一次吸空有全局重置');
    if (rules.nourish < 1) parts.push('只顶一半饱');
    return parts.join(' · ');
  }
  // 饱食低到浅尝都撑不过今晚时，在邀请卡上先说清楚，不用读完一整段来访才发现。
  function dangerFor(id) {
    const offers = modes.map(mode => C.preview(state, id, mode)).filter(offer => offer.allowed);
    if (!offers.length || offers.every(offer => offer.energyAfter > 0)) return '';
    const best = Math.max(...offers.map(offer => offer.energyAfter));
    return best <= 0 ? '补给再多也撑不过今晚' : '吸得少会撑不过今晚 · 最多到饱食 ' + best;
  }
  function halfNourish(id) { return C.constants.characters[id].nourish < 1; }
  function feedSummary(offer, id) {
    return '消耗 <strong>' + offer.cost + ' Token</strong>，吸到 <strong>' + offer.feed + '</strong>' + (halfNourish(id) ? '（只顶一半饱）' : '') + '，扣掉今晚夜耗 ' + offer.drain + '，饱食从 ' + state.energy + ' 变为 <strong>' + offer.energyAfter + '</strong>。';
  }
  function pickMode(mode) {
    if (onCover || view.phase !== 'mode' || !modes.includes(mode)) return;
    const offer = C.preview(state, state.selected, mode);
    if (!offer.allowed) return notify(offer.reason);
    if (offer.energyAfter <= 0 || mode === 'greedy') {
      const fatal = offer.energyAfter <= 0;
      pendingMode = mode;
      const who = pronoun(state.selected);
      const rest = restDescription(offer);
      const hint = unlockHint(mode);
      openModal(fatal ? '补给不足，仍然继续吗？' : '确认贪心，把' + D.characters[state.selected].name + '的额度吸空？','<p>' + esc(D.characters[state.selected].name) + ' · ' + modeNames[mode] + '</p><div class="notice"><p>' + feedSummary(offer, state.selected) + '</p>' + (offer.wasted > 0 ? '<p>饱食上限 ' + C.constants.maxEnergy + '，吃不下的 <strong>' + offer.wasted + '</strong> 会溢出浪费。</p>' : '') + (rest ? '<p>' + esc(rest) + '</p>' : '') + (hint && !fatal ? '<p class="unlock-hint">' + esc(hint) + '</p>' : '') + '</div>' + (fatal ? '<p class="warning">饱食将归零。继续会进入缺乏补给的虚弱片段，读完后抵达饥饿结局；不会出现正常补给 CG。你也可以取消并重新选择。</p>' : (offer.resetNextNight ? '<p>贪心要' + who + '本人点头。之后再吸空' + who + '，就没有重置了，要和别人一样歇一晚。</p>' : '<p>贪心会把' + who + '的额度吸到零。确认后就不能改了。</p>')) + '<div class="modal-actions is-sticky"><button data-action="cancel-fatal" autofocus>取消，重新考虑</button><button class="primary" data-action="' + (fatal ? 'confirm-fatal' : 'confirm-mode') + '">' + (fatal ? '仍然继续，接受饥饿结局' : '确认贪心') + '</button></div>', '[data-action="cancel-fatal"]');
      return;
    }
    executeMode(mode);
  }
  function executeMode(mode) {
    if (onCover || view.phase !== 'mode' || !modes.includes(mode)) return;
    const offer = C.preview(state, state.selected, mode);
    assert(offer.allowed, offer.reason);
    if (offer.energyAfter <= 0 || mode === 'greedy') assert(dialog.open && pendingMode === mode, '危险模式需要明确确认。');
    commitUI(C.commit(state, mode), afterAction(view, 'supplement'));
    closeModal();
    inspectImages();
  }
  function advanceNight() {
    if (onCover || view.phase !== 'morning' || view.cursor !== readingLines(state, 'morning').length) return;
    const next = C.advance(state);
    commitUI(next, afterAction(view, next.phase === 'ended' ? 'ending' : 'common'));
  }

  function icon(name) {
    const paths = {
      next: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
      log: '<path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8M8 13h5"/>',
      save: '<path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
      gallery: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 6-5 4 3 4-5 4 6"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      restore: '<path d="M3 7h13a5 5 0 0 1 0 10h-5M7 3 3 7l4 4"/>',
      shallow: '<path d="M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11Z"/>',
      deep: '<path d="M8 5c-2 3-5 6-5 9a5 5 0 0 0 10 0c0-3-3-6-5-9Zm9-3c-1 3-4 5-4 8a4 4 0 0 0 8 0c0-3-3-5-4-8Z"/>',
      greedy: '<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1 3-6Z" fill="currentColor" fill-opacity=".16"/>',
      skip: '<path d="m5 6 6 6-6 6M12 6l6 6-6 6"/>',
      auto: '<path d="M8 5v14l11-7L8 5Z"/>'
    };
    return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths[name] + '</svg>';
  }
  function toolbar() {
    const reading = readingPhases.includes(view.phase);
    const skip = reading && skipTarget();
    const tool = (action, name, label, extra = '') => '<button class="quiet" data-action="' + action + '" aria-label="' + label + '"' + extra + '>' + icon(name) + '<span>' + label + '</span></button>';
    return '<nav class="reading-tools" aria-label="阅读工具">' + tool('open-log', 'log', '回看') + tool('open-saves', 'save', '存档') + tool('open-gallery', 'gallery', '收藏') + tool('skip-read', 'skip', '跳过已读', ' title="跳到下一句没读过的话或下一个选择"' + (skip ? '' : ' disabled')) + '<button class="quiet' + (autoOn ? ' is-on' : '') + '" data-action="toggle-auto" aria-label="自动" aria-pressed="' + autoOn + '" title="按句子长短自动翻页，遇到选择会停">' + icon('auto') + '<span>自动</span></button></nav>';
  }
  function signed(value) { return value > 0 ? '+' + value : value < 0 ? '−' + Math.abs(value) : '±0'; }
  function nightStatus() {
    const low = state.energy <= 10;
    const max = C.constants.maxEnergy;
    if (view.phase === 'ending') {
      // 后记读完以前不在顶栏提前亮出结局标题。
      const done = view.cursor >= readingLines(state, 'ending').length;
      return '<div class="night-status is-ending" aria-label="后记"><span class="night-title"><b>后记</b>' + (done ? '<span>' + esc(D.endings[state.endingId].title) + '</span>' : '') + '</span></div>';
    }
    const prologue = view.phase === 'intro';
    const drain = C.drainFor(state.night);
    // 夜耗在确认补给时就和补给一起扣掉了：结算之后标成「已结算」，不再像一笔还没付的账。
    const settled = state.phase === 'result';
    const result = state.lastResult;
    const delta = settled && view.phase === 'supplement' && view.cursor === 0 ? result.energyAfter - result.energyBefore : null;
    const label = (prologue ? '序章' : '第 ' + state.night + ' 晚，共四晚') + '；饱食 ' + state.energy + ' / ' + max + (delta !== null ? '，本次 ' + signed(delta) : '') + '；今晚夜耗 ' + drain + (settled ? '，已结算' : '，补给时一起结算');
    const drainChip = '<span class="energy-drain' + (settled ? ' is-settled' : '') + '" title="' + (settled ? '今晚夜耗 ' + drain + '，已和补给一起结算' : '今晚夜耗 ' + drain + '，确认补给时一起结算') + '"><span class="drain-word">今晚 </span>−' + drain + (settled ? '<span class="drain-done"> ✓<span class="drain-done-text"> 已结算</span></span>' : '') + '</span>';
    return '<div class="night-status" aria-label="' + label + '"><span class="night-dots" aria-hidden="true">' + [1, 2, 3, 4].map(night => '<i class="' + (night === state.night && !prologue ? 'current' : night < state.night ? 'past' : '') + '"></i>').join('') + '</span><span class="night-title"><b>' + (prologue ? '序章' : '第 ' + state.night + ' 晚') + '</b><span>' + esc(prologue ? '初次见面' : D.nights[state.night - 1].title.replace(/^第.晚\s*·\s*/, '')) + '</span></span><span class="energy-chip' + (low ? ' is-low' : '') + '"><span class="energy-main"><span class="energy-label">饱食</span><span class="energy-value"><b>' + state.energy + '</b><span class="energy-max">/' + max + '</span></span>' + (delta !== null ? '<span class="energy-delta ' + (delta < 0 ? 'is-down' : 'is-up') + '" aria-hidden="true">' + signed(delta) + '</span>' : '') + '</span><span class="energy-bar" aria-hidden="true"><i style="width:' + Math.round(Math.min(1, state.energy / max) * 100) + '%"></i></span>' + drainChip + (low ? '<small>' + (state.energy === 0 ? '补给不足' : '有些饿了') + '</small>' : '') + '</span></div>';
  }
  function header() {
    const inGame = !onCover && state && !schemaError;
    return '<header class="header' + (inGame ? ' is-game' : '') + '"><button class="brand quiet" data-action="home" aria-label="我被 Agent 包围了，返回封面"><span class="brand-mark" aria-hidden="true"></span><span><strong>我被 Agent 包围了</strong><small>FOUR NIGHTS / AFTERHOURS</small></span></button>' + (inGame ? nightStatus() : '') + '<nav aria-label="游戏菜单"><button class="quiet" data-action="help">玩法</button></nav></header>';
  }
  function footer() {
    return '<footer class="footer"><span>成年虚构角色 · 离线阅读 · 无真实 Token 扣费</span><button class="quiet" data-action="licenses">许可与素材</button></footer>';
  }
  function coverScreen() {
    const saved = schemaError ? null : saveInfo('auto');
    const cards = ids.map(id => {
      const person = D?.characters?.[id];
      return '<button class="cover-person" data-action="profile" data-id="' + id + '" aria-label="查看 ' + esc(person?.name || id) + ' 的人物资料"><span class="cover-person-name"><strong>' + esc(person?.name || id) + '</strong><small>' + esc(person?.animal || '角色') + '</small></span></button>';
    }).join('');
    return '<main id="main-content" class="cover" tabindex="-1">' + image('cover', 'cover-hero', '') + '<span class="cover-issue">ISSUE 01 / FOUR NIGHTS</span><section class="cover-copy"><p class="cover-kicker">一场留到深夜的群像故事</p><h1><span>完蛋，</span><span>我被 Agent</span><em>包围了</em></h1><p class="cover-subtitle">四个夜晚，四种靠近。<br>在灯熄灭以前，选一句真正想说的话。</p><nav class="cover-actions" aria-label="开始与继续游戏"><button class="cover-start" data-action="new-game"' + (schemaError ? ' disabled' : '') + '><span>开始游戏</span>' + icon('next') + '</button><button data-action="continue-auto"' + (!saved || saved.damaged ? ' disabled' : '') + '><span>继续游戏' + (saved && !saved.damaged ? '<small class="cover-progress">' + esc(saved.state.phase === 'ended' ? '已读到后记' : '第 ' + saved.state.night + ' 晚 · 饱食 ' + saved.state.energy) + '</small>' : '') + '</span>' + icon('next') + '</button><button data-action="open-gallery"><span>回忆相册</span>' + icon('gallery') + '</button></nav>' + (!saved && legacyAuto() ? '<p class="cover-note">规则更新了，旧版进度没法接着玩；相册里收过的画面都还在。</p>' : '') + '<section class="cover-art" aria-label="四位成年室友，选择人物查看资料"><p class="cover-art-note">室友资料</p><div class="portrait-shelf">' + cards + '</div></section></section></main>';
  }
  // 解锁的那一晚，名册要等「那天晚上，走廊里有四扇门」读到了才亮起来，不在 CG 播放时提前剧透。
  function revealed(game) {
    if (!C.unlocked(game)) return false;
    if (!justUnlocked(game)) return true;
    if (game.history.at(-1).night === game.night) return false;
    if (view.phase === 'common') return view.cursor >= readingLines(game, 'common').length - unlockLines(game).length;
    return true;
  }
  function unseenFor(id) { return C.constants.characters[id].hidden && !revealed(state); }
  function isNew(id) { return C.constants.characters[id].hidden && justUnlocked(state) && state.history.at(-1).night === state.night - 1 && revealed(state); }
  function hearts(id, pending = 0) {
    const count = state.characters[id].affinity;
    if (!count && !pending) return '';
    return '<span class="affinity" role="img" title="心意" aria-label="心意 ' + count + (pending ? '，这次再加 ' + pending : '') + '">' + '♥'.repeat(count) + (pending ? '<i>' + '♥'.repeat(pending) + '</i>' : '') + '</span>';
  }
  // 第四晚：见过两次、心意够的人会留下来；只用 state 推算，不改规则。
  function endingCue(id) {
    if (state.night !== C.constants.nights || state.phase !== 'select') return '';
    const stats = state.characters[id];
    if (stats.visits < 1) return '';
    return stats.affinity + 1 >= 3 ? '今晚找' + pronoun(id) + '，会走进' + pronoun(id) + '的后记' : '说真心话，才会走进' + pronoun(id) + '的后记';
  }
  function unseenStatus(id) {
    const base = '零还没注意到' + pronoun(id);
    // 条件已经满足、但要等走廊那一幕才揭晓：保留进度，不让计数凭空消失。
    if (C.unlocked(state)) return base + ' · 条件已满足（' + pair(C.constants.unlockAfter.length, C.constants.unlockAfter.length) + '），' + (state.history.at(-1)?.night === state.night ? '下一晚' : '今晚') + '就会注意到' + pronoun(id);
    return base + ' · 先对 ' + C.constants.unlockAfter.map(other => D.characters[other].name).join('、') + ' 各用一次「贪心」（' + pair(unlockDone(state), C.constants.unlockAfter.length) + '）';
  }
  function selectPanel() {
    const choosing = view.phase === 'select';
    const ending = view.phase === 'ending';
    const result = state.lastResult;
    return '<aside class="selection-panel' + (choosing ? ' is-choosing' : '') + '" aria-label="四位角色名册"' + (uiHidden ? ' inert aria-hidden="true"' : '') + '><h2 class="panel-label">' + (choosing ? '今晚邀请谁' : ending ? '四位室友' : '今夜在场') + '</h2><div class="select-grid">' + ids.map(id => {
      const person = D.characters[id];
      const stats = state.characters[id];
      const offer = C.preview(state, id, 'greedy');
      const blocked = stats.blockedNight === state.night;
      const selectable = choosing && offer.allowed;
      const selected = state.selected === id;
      const unseen = unseenFor(id);
      const fresh = !unseen && isNew(id);
      const cue = !unseen && selectable ? endingCue(id) : '';
      const status = ending ? '' : unseen ? unseenStatus(id) : blocked ? '昨晚被吸空 · 本晚休息 · 下一晚恢复' : selected ? '今晚在一起' : choosing && !offer.allowed ? offer.reason : cue;
      // 刚结算完的第一句，被吸的人名册上浮出一个扣减数。
      const spent = view.phase === 'supplement' && view.cursor === 0 && result?.character === id && result.energyAfter > 0 ? '<span class="token-delta" aria-hidden="true">−' + result.cost + '</span>' : '';
      const trait = choosing && !unseen && !ending && traitFor(id) ? '<small class="person-trait">' + esc(traitFor(id)) + '</small>' : '';
      return '<button class="select-person' + (selected ? ' is-selected' : '') + (blocked ? ' is-resting' : '') + (unseen ? ' is-unseen' : '') + (fresh ? ' is-new' : '') + (cue ? ' has-cue' : '') + '" data-action="select-person" data-id="' + id + '" aria-pressed="' + selected + '"' + (!selectable ? ' disabled' : '') + '><span class="person-avatar">' + image(id, 'select-portrait', '') + '</span><span class="person-main"><span class="person-identity"><strong>' + esc(person.name) + '</strong>' + (fresh ? '<span class="badge-new">新</span>' : '') + '<small class="person-tag">' + esc(person.animal) + '</small>' + (unseen ? '' : hearts(id)) + '</span><span class="token-meter" aria-hidden="true"><i style="width:' + Math.round(stats.tokens / stats.cap * 100) + '%"></i></span><span class="person-token">Token <b>' + stats.tokens + '</b>\u00a0/\u00a0' + stats.cap + spent + '</span>' + trait + '</span>' + (status ? '<span class="availability">' + esc(status) + '</span>' : '') + '</button>';
    }).join('') + '</div></aside>';
  }
  // 选人放进对白框：视线停在哪里，选择就在哪里。名册仍是完整状态栏。
  function inviteList() {
    const rows = ids.filter(id => !unseenFor(id) && C.preview(state, id, 'greedy').allowed).map((id, index) => {
      const person = D.characters[id];
      const stats = state.characters[id];
      const cue = endingCue(id);
      const danger = dangerFor(id);
      return '<button class="invite' + (cue ? ' has-cue' : '') + '" data-action="invite" data-id="' + id + '" style="--speaker:' + esc(person.color) + '"><span class="person-avatar">' + image(id, 'select-portrait', '') + '</span><span class="invite-main"><span class="invite-name"><strong>' + esc(person.name) + '</strong>' + (isNew(id) ? '<span class="badge-new">新</span>' : '') + hearts(id) + '<span class="key-hint" aria-hidden="true">' + (index + 1) + '</span></span><small>Token ' + pair(stats.tokens, stats.cap) + '</small>' + (traitFor(id) ?'<small class="invite-trait">' + esc(traitFor(id)) + '</small>' : '') + (danger ? '<small class="invite-danger">' + esc(danger) + '</small>' : '') + (cue ? '<small class="invite-cue">' + esc(cue) + '</small>' : '') + '</span></button>';
    });
    // 今晚点不了的人也写在邀请旁边：为什么不在、什么时候回来。只是说明文字，不是按钮。
    const away = ids.filter(id => !unseenFor(id) && !C.preview(state, id, 'greedy').allowed).map(id => {
      const name = D.characters[id].name;
      if (state.characters[id].blockedNight !== state.night) return name + ' 今晚来不了';
      return name + ' 今晚休息（昨晚被吸空）' + (state.night >= C.constants.nights ? '，这一局见不到了' : ' · 第 ' + (state.night + 1) + ' 晚回来');
    });
    const unseen = ids.filter(id => unseenFor(id));
    if (unseen.length) away.push('还有 ' + unseen.length + ' 位室友，零暂时没注意到 · 先对 ' + C.constants.unlockAfter.map(id => D.characters[id].name + (greedied(state, id) ? ' ✓' : ' ○')).join('、') + ' 各用一次「贪心」');
    return (rows.length ? '<div class="invite-list">' + rows.join('') + '</div>' : '') + (away.length ? '<ul class="invite-away">' + away.map(row => '<li>' + esc(row) + '</li>').join('') + '</ul>' : '');
  }
  // 第四晚回应之前：说清楚这句话会不会把故事带进对方的后记。
  function talkCue(id) {
    const stats = state.characters[id];
    const who = pronoun(id);
    if (stats.visits < 1) return '之前没来找过' + who + '：今晚之后是大家的后记';
    if (stats.affinity + 1 >= 3) return '心意已经够了：哪句话都会走进' + who + '的后记';
    if (stats.affinity + 2 >= 3) return '说真心话（♥♥），才会走进' + who + '的后记';
    return '心意还不够：今晚之后是大家的后记';
  }
  function modePanel() {
    const id = state.selected;
    const person = D.characters[id];
    const stats = state.characters[id];
    const drain = C.drainFor(state.night);
    return '<div class="mode-panel"><div class="mode-title"><p class="eyebrow">补给选择</p><h2 id="mode-heading" tabindex="-1">想从今晚得到多少？</h2><p class="mode-person">' + esc(person.name) + ' 现有 ' + pair(stats.tokens, stats.cap) + ' Token · 你的饱食 ' + pair(state.energy, C.constants.maxEnergy) + '</p>' + (state.history.length ? '' : '<p class="mode-person">今晚夜耗 ' + drain + '，会和补给一起结算。</p>') + '</div><div class="mode-grid">' + modes.map((mode, index) => {
      const offer = C.preview(state, id, mode);
      const warning = !offer.allowed ? offer.reason : offer.energyAfter <= 0 ? '将抵达饥饿结局 · 需再次确认' : offer.warning || (mode === 'greedy' ? '额度清零 · 确认时可以取消' : '');
      const rest = restDescription(offer);
      const hint = offer.allowed && !offer.fatal ? unlockHint(mode) : '';
      // 饱食是升是降要一眼看出来：箭头加颜色，不只靠颜色。
      const delta = offer.energyAfter - state.energy;
      const trend = delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : 'is-flat';
      const arrow = delta > 0 ? '↑' + delta : delta < 0 ? '↓' + -delta : '±0';
      // 重玩时标出哪一档会给新画面（第一局什么都没收过时不标）。
      const cg = offer.allowed && !offer.fatal && collection.length ? (collection.includes(D.cgMap[id][mode]) ? '<small class="mode-tag is-seen">已收藏</small>' : '<small class="mode-tag is-new">新画面</small>') : '';
      return '<button class="mode-card' + (offer.fatal ? ' is-danger' : '') + '" data-action="pick-mode" data-mode="' + mode + '"' + (!offer.allowed ? ' disabled' : '') + '><span class="mode-heading"><span class="mode-symbol">' + icon(mode) + '<span class="key-hint" aria-hidden="true">' + (index + 1) + '</span></span><strong>' + modeNames[mode] + '</strong>' + cg + '<span class="mode-cost">消耗 ' + offer.cost + ' Token</span></span><span class="mode-energy">饱食 ' + state.energy + ' → <b class="' + trend + '">' + offer.energyAfter + '</b> <span class="mode-delta ' + trend + '">' + arrow + '</span></span><small>补给 +' + offer.feed + ' · 夜耗 −' + offer.drain + ' · ' + esc(person.name) + ' 剩 ' + offer.tokensAfter + '</small>' + (offer.wasted > 0 ? '<small class="mode-note">吃不下 ' + offer.wasted + '，溢出浪费</small>' : '') + (halfNourish(id) ? '<small class="mode-note">只顶一半饱</small>' : '') + (rest ? '<small class="mode-rest">' + esc(rest) + '</small>' : '') + (hint ? '<small class="mode-hint">' + esc(hint) + '</small>' : '') + (warning ? '<small class="mode-warning">' + esc(warning) + '</small>' : '') + '</button>';
    }).join('') + '</div></div>';
  }
  function visualForScene() {
    if (view.phase === 'supplement' && state.lastResult.energyAfter > 0) return { key: D.cgMap[state.lastResult.character][state.lastResult.mode], person: state.lastResult.character, event: true };
    // 「明天也在这里」是四个人的后记：用封面群像，不再重放某一个人的补给 CG。
    if (view.phase === 'ending' && state.endingId === 'household') return { key: 'cover', person: null, event: true, group: true };
    if (view.phase === 'ending' && state.endingId !== 'hunger' && state.lastResult?.energyAfter > 0) return { key: D.cgMap[state.lastResult.character][state.lastResult.mode], person: state.lastResult.character, event: true, reused: true };
    // 「那天晚上，走廊」只有关着的门：空房间，不让前面饭桌上的人留在台上。
    if (view.phase === 'common' && unlockLines(state).length && view.cursor >= readingLines(state, 'common').length - unlockLines(state).length) return { key: null, person: null, event: false };
    // 室友说完话后的一两句旁白，人还站在原地，不要每句都闪一下空房间。
    const lines = readingLines(state, view.phase);
    let person = state.selected;
    for (let index = Math.min(view.cursor, lines.length - 1), back = 0; index >= 0 && back <= 3; index -= 1, back += 1) {
      const who = stageFor(lines[index]);
      if (!who) continue;
      // 零还没注意到的人开口：台上空着，不提前露出他，也不把前面的人留在台上；
      // 这之后的旁白如果点了某位看得见的室友（「我在闻 Codex」），就让那个人出现。
      person = who === offstage ? mentionedIn(lines[view.cursor]) : who;
      break;
    }
    return { key: person, person, event: false };
  }
  // 这一句该站在台上的人：室友自己说的话是本人（零还没注意到的人返回 offstage）；旁白只认句首点名的人
  // （「Codex 早饭吃得很慢」「第二天早上，Codex……」「……。WorkBuddy 推了推眼镜」），
  // 句中顺带提到的名字（「别跟 Codex 讲」「比 Codex 便宜」）不算。
  function stageFor(line) {
    if (!line) return null;
    if (ids.includes(line.speaker)) return unseenFor(line.speaker) ? offstage : line.speaker;
    if (line.speaker !== 'narrator' || /^[“"「]/.test(line.text)) return null;
    const sentences = line.text.split(/[。！？]/);
    for (let order = 0; order < sentences.length; order += 1) {
      const sentence = sentences[order];
      let best = null;
      let at = Infinity;
      ids.forEach(id => {
        if (unseenFor(id)) return;
        const index = sentence.indexOf(D.characters[id].name);
        if (index < 0 || index >= at) return;
        const before = sentence.slice(0, index);
        // 名字前只允许很短的时间、地点或称呼：「早上，」「另一扇门开着，」；第一句还允许「白狼 」「早上 」。
        if (before && (Array.from(before).length > 8 || !(/[，,]$/.test(before) || (order === 0 && /\s$/.test(before))))) return;
        best = id;
        at = index;
      });
      if (best) return best;
    }
    return null;
  }
  // 旁白里点到、零已经注意到的室友：只有一位时才算（两位都提到就不猜）。
  function mentionedIn(line) {
    if (!line || line.speaker !== 'narrator' || /^[“"「]/.test(line.text)) return null;
    const named = ids.filter(id => !unseenFor(id) && line.text.includes(D.characters[id].name));
    return named.length === 1 ? named[0] : null;
  }
  function sceneTitleFor() {
    if (view.phase === 'intro') return '序章 · 初次见面';
    if (view.phase === 'common' || view.phase === 'select') {
      const opening = openingLines(state).length;
      const night = D.nights[state.night - 1].title;
      if (view.phase === 'common' && view.cursor < opening) return view.cursor >= D.openings.after[state.history.at(-1).character].length ? '半夜 · 官方重置' : '昨晚之后';
      if (view.phase === 'common' && unlockLines(state).length && view.cursor >= readingLines(state, 'common').length - unlockLines(state).length) return '那天晚上 · 走廊';
      return night;
    }
    if (['visit', 'choice', 'reply', 'mode'].includes(view.phase) && state.selected) return routeFor(state).title;
    if (view.phase === 'morning') return '翌日清晨';
    if (view.phase === 'ending') return '后记';
    return '';
  }
  // 白天：晨间片段、次晨反应和这一晚白天的公共对白用晨光；读到「到了晚上」「天还没黑」「傍晚」这类句子才换回夜里的灯。
  function morningLight() {
    if (view.phase === 'morning') return true;
    if (view.phase !== 'common' || state.night < 2) return false;
    const line = readingLines(state, 'common')[view.cursor];
    if (!line || /半夜|深夜/.test(line.text)) return false;
    const opening = openingLines(state).length;
    if (view.cursor < opening) return true;
    const common = D.nights[state.night - 1].common;
    const dusk = common.findIndex(row => /晚上|傍晚|天还没黑|天黑|当晚/.test(row.text));
    return view.cursor - opening < (dusk < 0 ? common.length : dusk);
  }
  function sceneArtwork() {
    const visual = visualForScene();
    const fallback = visual.event && failedAssets.has(visual.key);
    const starving = state.energy <= 0 && ['supplement', 'morning', 'ending'].includes(view.phase);
    const visualKey = (visual.key || 'room') + (visual.event ? ':event' : '');
    const entering = visualKey !== lastVisualKey;
    const leaving = lastCharacterKey;
    const shown = Boolean(visual.key) && view.phase !== 'select';
    lastVisualKey = visualKey;
    lastCharacterKey = shown && !visual.event ? visual.key : '';
    const enter = entering ? ' is-entering' : '';
    let figure = '';
    // 换人时交叉淡化：上一位先在下面淡出，新的一位淡入，不再闪过空房间。减少动态效果时不留旧图。
    if (entering && leaving && leaving !== visual.key && !calm()) figure += image(leaving, 'character-art is-leaving', '');
    if (visual.group) figure += image('cover', 'event-art group-art' + enter, '四位室友的合照');
    else if (shown) figure += image(visual.key, (visual.event && !fallback ? 'event-art' : 'character-art') + enter, visual.event && !fallback ? D.characters[visual.person].name + ' · ' + modeNames[state.lastResult.mode] + '事件插图' : D.characters[visual.person].name + ' 的人物图', visual.event ? visual.person : '');
    // 事件图上不再压说明：补给档名移到对白框的行号前；只有缺图代示时才在画面上说明。
    const caption = visual.event && fallback ? '人物图代示 · 本场景 CG 尚未提供' : '';
    return '<div class="scene-art' + (visual.event && !fallback ? ' has-event' : '') + (starving ? ' is-starving' : '') + '"' + (morningLight() ? ' data-daypart="morning"' : '') + '>' + image('room', 'scene-background', '合租房') + figure + (caption ? '<p class="art-caption">' + caption + '</p>' : '') + '</div>';
  }
  function sceneHeading() {
    const title = view.phase === 'supplement' ? '' : sceneTitleFor();
    if (!title) return '';
    // 一晚（和序章）的第一句：标题卡片放大，写明是第几晚；下一句起收回成小标签。
    if (view.cursor === 0 && ['intro', 'common'].includes(view.phase)) {
      const chapter = view.phase === 'intro' ? '序章' : D.nights[state.night - 1].title;
      const sub = view.phase === 'intro' ? '初次见面' : title === chapter ? '' : title;
      return '<div class="scene-heading is-chapter is-entering"><strong>' + esc(chapter) + '</strong>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    }
    return '<div class="scene-heading' + (view.cursor === 0 || view.phase === 'select' ? ' is-entering' : '') + '"><strong>' + esc(title) + '</strong></div>';
  }
  function dialogue() {
    let content;
    let advance = '';
    if (view.phase === 'select') {
      const invites = inviteList();
      const invitable = ids.some(id => !unseenFor(id) && C.preview(state, id, 'greedy').allowed);
      content = '<div class="dialogue-intro"><h2 id="select-heading" tabindex="-1">今晚，想去找谁？</h2><p>' + (invitable ? '点一个人。先聊天，补给等聊完再定。' : '在「今晚邀请谁」里点一个人。') + '</p></div>' + invites;
    } else if (view.phase === 'choice') {
      const last = visitLines(state).at(-1);
      const finalNight = state.night === C.constants.nights;
      // 回应会记进心意：平时只说规则；第四晚这一句决定后记，标出哪句是真心话。
      const hint = finalNight ? talkCue(state.selected) : '回应会被记住：真心话 ♥♥ · 玩笑 ♥';
      content = (last ? '<div class="choice-context">' + speakerTag(last) + '<p>' + esc(last.text) + '</p></div>' : '') + '<div class="choice-head"><h2 class="choice-heading" id="choice-heading" tabindex="-1">你想怎样回答？</h2><p class="choice-hint' + (finalNight ? ' is-final' : '') + '">' + esc(hint) + '</p></div><div class="choice-list">' + routeFor(state).choices.map((choice, index) => {
        const read = readLines.has(lineHash(choice.reply[0]));
        const heartsLabel = finalNight ? '<span class="choice-hearts" role="img" aria-label="' + (index === 0 ? '真心话，心意 +2' : '玩笑话，心意 +1') + '">' + (index === 0 ? '♥♥' : '♥') + '</span>' : '';
        return '<button class="choice" data-action="choose" data-index="' + index + '"><span class="choice-number">0' + (index + 1) + '</span><span class="choice-label">' + esc(choice.label) + heartsLabel + (read ? '<small class="choice-seen">读过</small>' : '') + '</span>' + icon('next') + '</button>';
      }).join('') + '</div>';
    } else if (view.phase === 'mode') {
      content = '<div class="speaker-row">' + speakerTag({ speaker: 'player', text: '' }) + '</div><p class="dialogue-text">话已经说到这里。今晚要从 ' + esc(D.characters[state.selected].name) + ' 那里补多少？</p><p class="mode-pointer"><span class="pointer-wide">在右侧「补给选择」里选一档 →</span><span class="pointer-narrow">在下方「补给选择」里选一档 ↓</span></p>';
    } else {
      const lines = readingLines(state, view.phase);
      const finished = view.cursor === lines.length;
      if (finished && view.phase === 'ending') {
        const ending = D.endings[state.endingId];
        // 每一晚的检查点都能回去重选：别的后记往往要从更早的一晚改起。
        const retries = Array.from({ length: state.night }, (_, index) => index + 1).filter(night => retryInfo(night));
        content = '<p class="eyebrow">故事结束 · 已见结局 ' + pair(endingsSeen.length, endingIds.length) + (freshEnding === state.endingId ? ' <span class="badge-new ending-new">新结局</span>' : '') + '</p><h2 class="ending-title" id="ending-title" tabindex="-1">' + esc(ending.title) + '</h2><p class="ending-subtitle">' + esc(ending.subtitle) + '</p><div class="ending-actions"><button class="primary" data-action="new-game">再玩一次</button>' + (retries.length === 1 ? '<button data-action="retry-night" data-night="' + retries[0] + '">回到第 ' + retries[0] + ' 晚重选</button>' : retries.length ? '<button class="retry-toggle" data-action="toggle-retry" aria-expanded="' + retryOpen + '">回到某一晚重选<span aria-hidden="true">' + (retryOpen ? '▴' : '▾') + '</span></button>' : '') + '<button data-action="open-endings">结局一览</button><button data-action="home">回到封面</button>' + (retries.length > 1 && retryOpen ? '<div class="retry-list" role="group" aria-label="回到这一局的某一晚">' + retries.map(night => '<button data-action="retry-night" data-night="' + night + '">第 ' + night + ' 晚</button>').join('') + '</div>' : '') + '</div>';
      } else if (finished && view.phase === 'morning') {
        content = '<h2 class="speaker-name is-page" id="page-end" tabindex="-1">合上这一页</h2><p class="dialogue-text">' + (state.energy <= 0 ? '这一夜没能撑过去。读过的话仍在手记里。' : state.night === 4 ? '最后一晚的话已经说完。接下来，是你们留下的后记。' : '这一晚，先写到这里。等你准备好，再翻开下一页。') + '</p>' + tomorrowRecap();
        advance = '<button class="primary advance" data-action="advance-night"><span>' + (state.energy <= 0 || state.night === 4 ? '阅读后记' : '进入下一晚') + '</span>' + icon('next') + '</button>';
      } else {
        const line = lines[view.cursor];
        const tag = speakerTag(line);
        const result = state.lastResult;
        const count = (view.phase === 'supplement' && result.energyAfter > 0 ? modeNames[result.mode] + ' · ' : '') + String(view.cursor + 1).padStart(2, '0') + ' / ' + String(lines.length).padStart(2, '0');
        content = (view.cursor === 0 ? choiceEcho() + resultInline() : '') + '<div class="speaker-row' + (tag ? '' : ' is-narration') + '">' + tag + '<span class="line-count">' + count + '</span></div><p class="dialogue-text' + (tag ? '' : ' is-narration') + '" id="dialogue-text" tabindex="-1">' + esc(line.text) + '</p>';
        advance = '<button class="primary advance" data-action="next"><span>' + (view.cursor === lines.length - 1 ? '读完这一句' : '下一句') + '</span>' + icon('next') + '</button>';
      }
    }
    return '<section class="dialogue" aria-label="剧情对白"' + (uiHidden ? ' inert aria-hidden="true"' : '') + '><div class="dialogue-copy">' + content + '</div><div class="dialogue-bottom">' + toolbar() + advance + '</div></section>';
  }
  // 回应之后的第一句：把零刚说出口的那句话和记下的心意留在对白框里，手机上不用往下翻右栏。
  function choiceEcho() {
    if (view.phase !== 'reply' || state.choice === null) return '';
    const gain = 1 + (state.choice === 0 ? 1 : 0);
    return '<p class="choice-echo"><span>你说：' + esc(routeFor(state).choices[state.choice].label) + '</span><span class="affinity" role="img" aria-label="心意 +' + gain + '"><i>' + '♥'.repeat(gain) + '</i></span></p>';
  }
  // 补给刚结算的第一句：窄屏上右栏在下面，把结算摘要放在视线里（宽屏由 CSS 隐藏，右栏已有同样内容）。
  function resultInline() {
    const result = state.lastResult;
    if (view.phase !== 'supplement' || !result) return '';
    const parts = [modeNames[result.mode], '饱食 ' + result.energyBefore + ' → ' + result.energyAfter];
    if (result.wasted > 0) parts.push('溢出 ' + result.wasted);
    if (result.energyAfter > 0) {
      const name = D.characters[result.character].name;
      if (result.resetNextNight) parts.push(name + ' 明晚全局重置回满');
      else if (result.blockedNextNight) parts.push(name + (result.night === 3 ? ' 明晚休息，这一局见不到了' : ' 明晚休息'));
      if (justUnlocked(state)) parts.push('零好像开始注意到屋里的其他人');
    }
    return '<p class="result-inline' + (result.energyAfter <= 0 ? ' is-danger' : '') + '">' + esc(parts.join(' · ')) + '</p>';
  }
  // 翻页前说清楚明晚会变什么：夜耗、谁回满、谁休息、谁的上限变了。只用 C.advance 预演，不提交。
  function tomorrowRecap() {
    if (state.energy <= 0 || state.night >= C.constants.nights) return '';
    let next;
    try { next = C.advance(state); } catch (_) { return ''; }
    const nextDrain = C.drainFor(next.night);
    const rows = ['明晚夜耗 ' + nextDrain + ' · 补给时一起结算'];
    ids.forEach(id => {
      if (C.constants.characters[id].hidden && !C.unlocked(state)) return;
      const name = D.characters[id].name;
      const before = state.characters[id];
      const after = next.characters[id];
      if (after.blockedNight === next.night) rows.push(name + ' 休息一晚');
      else if (before.tokens === 0 && after.tokens > 0) rows.push(name + ' 回满 ' + after.tokens + (id === 'codex' && state.lastResult.resetNextNight ? '（官方重置）' : ''));
      else if (after.cap !== before.cap) rows.push(name + ' 上限 ' + before.cap + ' → ' + after.cap);
      else if (after.tokens !== before.tokens) rows.push(name + ' Token ' + before.tokens + ' → ' + after.tokens);
    });
    if (justUnlocked(state)) rows.push('零好像开始注意到屋里的其他人');
    // 饱食已经扛不住明晚的夜耗：提前说要吸到多少，不等读完来访才发现。
    const warning = state.energy <= nextDrain ? '<li class="is-warning">饱食 ' + state.energy + ' 撑不过明晚夜耗 ' + nextDrain + '：至少要吸到 ' + (nextDrain - state.energy + 1) + '</li>' : '';
    return '<ul class="recap" aria-label="明晚">' + warning + rows.map(row => '<li>' + esc(row) + '</li>').join('') + '</ul>';
  }
  // 右栏只放此刻用得上的东西：人物、这一晚的结算、四晚手记。
  function journal() {
    if (!state.history.length) return '';
    return '<div class="journal"><h3 class="panel-label">手记</h3><ol>' + state.history.map(entry => '<li><span>第 ' + entry.night + ' 晚</span><strong>' + esc(D.characters[entry.character].name) + '</strong><em>' + modeNames[entry.mode] + '</em></li>').join('') + '</ol></div>';
  }
  function resultNote() {
    const result = state.lastResult;
    if (!result || !['supplement', 'morning'].includes(view.phase)) return '';
    const danger = result.energyAfter <= 0;
    const name = D.characters[result.character].name;
    const unlockedNow = !danger && justUnlocked(state);
    return '<div class="result-note' + (danger ? ' is-danger' : '') + '"><strong>' + (danger ? '补给不足' : '今晚 · ' + modeNames[result.mode]) + '</strong><p>用去 ' + result.cost + ' Token · 吸到 ' + result.feed + ' · 饱食 ' + result.energyBefore + ' → ' + result.energyAfter + '（已扣今晚夜耗 ' + C.drainFor(result.night) + '）</p>' + (result.wasted > 0 ? '<p>吃不下 ' + result.wasted + '，溢出浪费。</p>' : '') + (result.blockedNextNight && !danger ? '<p>' + esc(name) + ' 明晚要休息' + (result.night === 3 ? '，这一局见不到了' : '') + '。</p>' : '') + (result.resetNextNight && !danger ? '<p>官方会给 Codex 发一次全局重置，明晚回满。</p>' : '') + (unlockedNow ? '<p class="unlock-hint">两个人都吸空过了。零好像开始注意到屋里的其他人。</p>' : '') + '</div>';
  }
  // 回应之后：真心话 +2、玩笑 +1 心意（提交补给时才记账），在右栏先让玩家看到这句话被记住了。
  function affinityCue(id) {
    if (!['reply', 'mode'].includes(view.phase) || state.choice === null) return '';
    const gain = 1 + (state.choice === 0 ? 1 : 0);
    return '<p class="affinity-cue">' + hearts(id, gain) + '<span>' + (state.choice === 0 ? pronoun(id) + '记住了这句真心话' : pronoun(id) + '被逗得笑了一下') + '</span></p>';
  }
  function selectNotes() {
    const notes = ['今晚夜耗 ' + C.drainFor(state.night) + '，确认补给时一起结算；你的饱食 ' + pair(state.energy, C.constants.maxEnergy) + '。归零就是饥饿结局。'];
    if (!C.unlocked(state)) {
      notes.push('让零注意到屋里的其他人：' + C.constants.unlockAfter.map(id => D.characters[id].name + (greedied(state, id) ? ' ✓' : ' ○')).join(' · ') + '（各用一次「贪心」吸空）。');
    }
    if (state.night === C.constants.nights) notes.push('最后一晚：今晚找的人，如果之前见过、心意攒到 ♥♥♥，会走进那个人的后记；不然就是大家的后记。');
    else notes.push('回应会记成心意（真心话 ♥♥，玩笑 ♥）。第 4 晚去找之前见过、心意攒到 ♥♥♥ 的人，会走进那个人的后记。');
    const exempt = ids.filter(id => state.characters[id].resets < C.constants.characters[id].resets).map(id => D.characters[id].name);
    notes.push('贪心会让对方明晚休息' + (exempt.length ? '（' + exempt.join('、') + ' 第一次除外）' : '') + '。');
    return '<ul class="rule-notes">' + notes.map(note => '<li>' + esc(note) + '</li>').join('') + '</ul>';
  }
  // 第一次玩：序章时右栏是空的，放一张三行的「怎么玩」。
  function howTo() {
    if (endingsSeen.length || state.history.length) return '';
    return '<div class="howto"><h3 class="panel-label">怎么玩</h3><ol class="rule-notes"><li>每晚找一个人：先聊天、选一句回应，再决定吸多少 Token。</li><li>饱食是零的体力，每晚的夜耗和补给一起结算；归零就是饥饿结局。</li><li>真心话攒心意，决定第 4 晚走进谁的后记。</li></ol><button class="quiet howto-more" data-action="help">完整玩法</button></div>';
  }
  function contextPanel() {
    const hidden = uiHidden ? ' inert aria-hidden="true"' : '';
    if (view.phase === 'mode') return '<aside class="context-panel mode-context" aria-label="补给决策"' + hidden + '>' + modePanel() + '</aside>';
    const id = ids.includes(state.selected) ? state.selected : null;
    let body;
    if (view.phase === 'ending') {
      // 结局标题只在对白框的结尾卡片上揭晓一次；右栏留手记与进度。
      const done = view.cursor >= readingLines(state, 'ending').length;
      body = '<div class="context-heading"><p class="panel-label">后记' + (done ? ' · 已见结局 ' + pair(endingsSeen.length, endingIds.length) : '') + '</p><h2>' + (done ? '这一局写完了' : '故事的后记') + '</h2></div>';
    } else if (id) {
      const person = D.characters[id];
      const visit = view.phase === 'supplement' || view.phase === 'morning' ? state.lastResult.visit : state.characters[id].visits + 1;
      body = '<div class="spotlight"><span class="person-avatar spotlight-avatar">' + image(id, 'select-portrait', '') + '</span><div class="spotlight-id"><p class="panel-label">第 ' + visit + ' 次去找' + pronoun(id) + '</p><h2>' + esc(person.name) + '</h2><p class="spotlight-meta">' + esc(person.age + ' 岁 · ' + person.animal) + '</p>' + (['reply', 'mode'].includes(view.phase) || !state.characters[id].affinity ? '' : '<p class="spotlight-heart">心意 ' + hearts(id) + '</p>') + '</div><blockquote>' + esc(person.tagline) + '</blockquote></div>' + affinityCue(id) + resultNote();
    } else {
      const night = D.nights[state.night - 1];
      body = '<div class="context-heading"><p class="panel-label">' + (view.phase === 'intro' ? '序章' : '第 ' + state.night + ' / 4 晚') + '</p><h2>' + esc(view.phase === 'intro' ? '初次见面' : night.title.replace(/^第.晚\s*·\s*/, '')) + '</h2>' + (view.phase === 'select' ? selectNotes() : '') + '</div>' + (view.phase === 'intro' ? howTo() : '');
    }
    return '<aside class="context-panel" aria-label="当前段落"' + hidden + '>' + body + journal() + '</aside>';
  }
  // DOM 顺序即阅读顺序（场景对白 → 右栏 → 名册），桌面三栏由 CSS 指定列位置；键盘 Tab 在任何宽度下都不再跳回顶部。
  function gameScreen() {
    return '<main id="main-content" class="game-page" data-phase="' + view.phase + '" tabindex="-1"><div class="novel-stage' + (uiHidden ? ' ui-hidden' : '') + '"><div class="game-grid"><section class="story-column"><div class="story-card"><div class="scene-frame">' + sceneArtwork() + sceneHeading() + '<button class="stage-ui-toggle" data-action="toggle-ui" aria-pressed="' + uiHidden + '" title="' + (uiHidden ? '恢复对白' : '纯看画面') + '">' + icon(uiHidden ? 'restore' : 'eye') + '<span>' + (uiHidden ? '恢复对白' : '纯看画面') + '</span></button></div>' + dialogue() + '</div></section>' + contextPanel() + selectPanel() + '</div></div></main>';
  }
  function toggleSceneUI() {
    if (onCover || !state || dialog.open) return;
    uiHidden = !uiHidden;
    const stage = root.querySelector('.novel-stage');
    stage.classList.toggle('ui-hidden', uiHidden);
    stage.querySelectorAll('.session-bar, .dialogue, .selection-panel, .context-panel').forEach(panel => {
      panel.inert = uiHidden;
      if (uiHidden) panel.setAttribute('aria-hidden', 'true');
      else panel.removeAttribute('aria-hidden');
    });
    const button = stage.querySelector('[data-action="toggle-ui"]');
    button.setAttribute('aria-pressed', String(uiHidden));
    button.title = uiHidden ? '恢复对白' : '纯看画面';
    button.innerHTML = icon(uiHidden ? 'restore' : 'eye') + '<span>' + (uiHidden ? '恢复对白' : '纯看画面') + '</span>';
    scheduleAuto();
  }
  function focusSelector(element) {
    if (!element || element === document.body) return null;
    if (element.id) return '#' + CSS.escape(element.id);
    if (!element.dataset?.action) return null;
    return '[data-action="' + CSS.escape(element.dataset.action) + '"]' + ['id', 'slot', 'mode', 'index', 'key', 'night'].filter(key => element.dataset[key] !== undefined).map(key => '[data-' + key + '="' + CSS.escape(element.dataset[key]) + '"]').join('');
  }
  // 原来的焦点随阶段消失时，落到新出现的决策区标题上（不是第一个选项，连按 Enter 不会误选），下一次 Tab 就是第一个选项。
  // 一晚读完落在「合上这一页」上（再按 Space / Enter / → 进入下一晚），后记读完落在结局标题上。
  function focusAfterRender(selector) {
    if (dialog.open) return;
    const target = selector && root.querySelector(selector);
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else (root.querySelector('#dialogue-text, #select-heading, #choice-heading, #mode-heading, #page-end, #ending-title') || root.querySelector('#main-content'))?.focus({ preventScroll: true });
  }
  // 单列布局（手机、窄窗口）里整页会滚动：换阶段时把新场景拉回视野，不然补给 CG 在屏幕外播完、也收不进相册。
  // 窗口不够高、「下一句」落在屏幕下方时，再往下挪到刚好看得见它，但不越过场景卡片的顶端（画面不被切掉）。
  // 同一阶段里：新对白跑到视野上方时拉回来；「下一句」本来看得见、被更长的一句挤到屏幕下方时跟着挪（同样不切画面）；
  // 顶栏变矮（结算后的 ± 数字消失）把画面顶端带出视野时挪回来；读者自己把按钮或画面滚出去的不动。
  // 一晚读完出现「进入下一晚」时把它挪进视野，只往下、不越过对白框顶端。
  function settleScroll(phaseChanged, endReached, before = {}) {
    if (onCover || !state || !narrow()) return;
    const behavior = calm() ? 'auto' : 'smooth';
    if (phaseChanged && view.phase === 'mode') {
      root.querySelector('.dialogue')?.scrollIntoView({ block: 'start', behavior });
      return;
    }
    const advance = root.querySelector('.dialogue .advance');
    const reveal = (base, ceiling) => {
      if (!advance || !ceiling) return base;
      const need = advance.getBoundingClientRect().bottom + scrollY + 8 - innerHeight;
      return Math.max(base, Math.min(need, ceiling.getBoundingClientRect().top + scrollY));
    };
    if (phaseChanged) {
      window.scrollTo({ top: reveal(0, root.querySelector('.story-card')), behavior });
      return;
    }
    const text = root.querySelector('#dialogue-text');
    if (text && text.getBoundingClientRect().top < 0) {
      root.querySelector('.dialogue')?.scrollIntoView({ block: 'start', behavior });
      return;
    }
    const card = root.querySelector('.story-card');
    let top = scrollY;
    if (before.cardShown && card && card.getBoundingClientRect().top < -1) top = card.getBoundingClientRect().top + scrollY;
    if (endReached || before.advanceShown) top = reveal(top, root.querySelector(endReached ? '.dialogue' : '.story-card'));
    if (Math.abs(top - scrollY) > 1) window.scrollTo({ top, behavior });
  }
  function announce() {
    const live = document.getElementById('line-live');
    if (!live) return;
    let message = '';
    if (!onCover && state) {
      const line = readingLines(state, view.phase)[view.cursor];
      if (readingPhases.includes(view.phase) && line) message = (speakerName(line) ? speakerName(line) + '：' : '') + line.text;
      else if (view.phase === 'choice') message = '你想怎样回答？有两个回应可选。';
      else if (view.phase === 'mode') message = '选择补给：浅尝、深补或贪心。';
      else if (view.phase === 'select') message = '今晚，想去找谁？';
    }
    if (live.textContent !== message) live.textContent = message;
  }
  function render() {
    const selector = focusSelector(document.activeElement);
    // 单列布局里记下重绘前「下一句」是否看得见、场景卡片是否完整在视野里，重绘后据此微调滚动。
    const oldAdvance = narrow() && root.querySelector('.dialogue .advance');
    const oldCard = narrow() && root.querySelector('.story-card');
    const before = { advanceShown: Boolean(oldAdvance) && oldAdvance.getBoundingClientRect().bottom <= innerHeight + 1, cardShown: Boolean(oldCard) && oldCard.getBoundingClientRect().top >= -1 };
    renderVersion += 1;
    if (onCover) { lastVisualKey = ''; lastCharacterKey = ''; }
    root.innerHTML = '<div class="shell">' + header() + (schemaError ? '<div class="schema-warning" role="alert">' + esc(schemaError) + ' 未接入前不会用旧十二轮剧情伪装四晚流程。</div>' : '') + (!storageOK ? '<div class="storage-warning" role="status">本地保存不可用，离开前请导出当前局。收藏也可能无法持久保存。</div>' : '') + (onCover ? coverScreen() + footer() : gameScreen()) + '</div>';
    const phaseKey = onCover || !state ? null : state.night + ':' + view.phase;
    // 可点的东西换了（换阶段，或一晚读完出现「进入下一晚」）：触屏连点保护半秒。
    const guardKey = phaseKey && readingPhases.includes(view.phase) && view.cursor >= readingLines(state, view.phase).length ? phaseKey + ':end' : phaseKey;
    const guardChanged = guardKey !== lastGuardKey;
    if (guardChanged) tapGuardUntil = performance.now() + 500;
    lastGuardKey = guardKey;
    settleScroll(phaseKey !== lastPhaseKey, guardChanged && guardKey !== phaseKey, before);
    lastPhaseKey = phaseKey;
    if (!onCover && state && readingPhases.includes(view.phase)) {
      const line = readingLines(state, view.phase)[view.cursor];
      if (line) markRead(line);
    }
    inspectImages();
    if (selector) focusAfterRender(selector);
    announce();
    scheduleAuto();
  }
  function unlockVisibleCG(img) {
    if (onCover || dialog.open || document.hidden || !state || view.phase !== 'supplement' || state.energy <= 0 || !img.isConnected || !img.complete || img.naturalWidth <= 0) return;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return;
    const key = D.cgMap[state.lastResult.character][state.lastResult.mode];
    if (img.dataset.asset !== key || !img.classList.contains('event-art') || collection.includes(key)) return;
    // 收藏只在当前场景图像实际解码、阅读场景可见后解锁，commit 本身不解锁。
    const disk = readStorage('collection');
    try {
      const saved = JSON.parse(disk || 'null');
      if (saved?.version === 2 && Array.isArray(saved.cgs)) collection = [...new Set([...collection, ...saved.cgs.filter(item => cgKeys.includes(item))])];
    } catch (_) { /* 继续保留当前内存中的收藏。 */ }
    collection = [...new Set([...collection, key])];
    writeStorage('collection', JSON.stringify({ version: 2, cgs: collection }));
  }
  function inspectImages() {
    const version = renderVersion;
    cgObserver.disconnect();
    root.querySelectorAll('img.event-art').forEach(img => {
      cgObserver.observe(img);
      if (img.complete && img.naturalWidth > 0) requestAnimationFrame(() => { if (version === renderVersion) unlockVisibleCG(img); });
    });
  }
  document.addEventListener('load', event => {
    if (event.target instanceof HTMLImageElement) {
      const img = event.target;
      const version = renderVersion;
      requestAnimationFrame(() => { if (version === renderVersion) unlockVisibleCG(img); });
    }
  }, true);
  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.asset) return;
    failedAssets.add(img.dataset.asset);
    const fallback = img.dataset.fallback;
    if (fallback) {
      img.dataset.asset = fallback;
      delete img.dataset.fallback;
      img.src = assetURL(fallback);
      img.alt = (D.characters[fallback]?.name || fallback) + ' 的人物图（场景 CG 尚未提供）';
      img.classList.remove('event-art');
      img.classList.add('character-art');
      const scene = img.closest('.scene-art');
      if (scene) {
        scene.classList.remove('has-event');
        let caption = scene.querySelector('.art-caption');
        if (!caption) {
          caption = document.createElement('p');
          caption.className = 'art-caption';
          scene.appendChild(caption);
        }
        caption.textContent = '人物图代示 · 本场景 CG 尚未提供';
      }
      const gallery = img.closest('.gallery-view');
      if (gallery) gallery.querySelector('.gallery-caption').textContent = '本地未找到这张事件图，暂用人物图代示。';
    } else {
      img.hidden = true;
      img.parentElement?.classList.add('image-missing');
    }
  }, true);

  function openModal(heading, html, focus = '[data-action="close-dialog"]') {
    if (!dialog.open) returnSelector = focusSelector(document.activeElement);
    tapGuardUntil = performance.now() + 500;
    dialog.innerHTML ='<div class="modal-header"><div><p class="eyebrow">我被 Agent 包围了</p><h2 id="dialog-title">' + esc(heading) + '</h2></div><button class="quiet close-button" data-action="close-dialog" aria-label="关闭弹窗">×</button></div><div class="modal-body">' + html + '</div>';
    if (!dialog.open) dialog.showModal();
    dialog.querySelector(focus)?.focus({ preventScroll: true });
  }
  function closeModal() {
    pendingMode = null;
    if (dialog.open) dialog.close();
    dialog.replaceChildren();
    const selector = returnSelector;
    returnSelector = null;
    focusAfterRender(selector);
    inspectImages();
    scheduleAuto();
  }
  function showProfile(id) {
    if (!ids.includes(id)) return;
    const person = D.characters?.[id];
    if (!person) return;
    openModal(person.name, '<div class="profile-layout"><div class="profile-frame">' + image(id, 'profile-portrait', person.name) + '</div><div><p class="eyebrow">' + esc(person.age + ' 岁 / ' + person.gender + ' / ' + person.animal) + '</p><h3>' + esc(person.role) + '</h3><blockquote>' + esc(person.tagline) + '</blockquote><p>' + esc(person.bio) + '</p></div></div><p class="fine-print">虚构成年角色；人物设定不代表真实产品能力。</p>');
  }
  function showHelp() {
    openModal('玩法说明', '<p class="help-goal"><strong>目标：撑过四个夜晚。</strong>饱食别归零；第 4 晚去找的人，如果心意够了，会走进那个人的后记。</p><p>你是零，一团靠 Token 活着的成年触手，借住在四个成年室友的合租房里。本作不联网、不调用模型、不扣真实额度。</p><ol><li>每晚读完开场，选一个人去找。聊完、选一句回应，再决定吸多少：浅尝 10 Token、深补 26 Token，或贪心把对方当前额度全吸光。</li><li>饱食初始 28，饱食上限 60，吃不下的部分会溢出浪费。零一晚比一晚饿：四晚的夜耗依次是 20、25、30、35。饱食归零就是饥饿结局。</li><li>浅尝、深补要求对方额度大于消耗；贪心要对方点头，被吸空的人下一晚要休息。</li><li>Codex 额度 90，没有五小时窗口，但每晚不回；她第一次被吸空时，官方会发一次全局重置，第二晚直接回满。只有这一次，之后再吸空她，就得歇一晚。</li><li>Claude 额度少，一下就空，但每晚都会回满，上限一晚比一晚高：30、38、46、54。</li><li>一开始，零眼里只有 Codex 和 Claude。两个人都被吸空过一次以后，零才会想起屋里的另外两个人：Cursor 额度 55，每晚回 12；WorkBuddy 便宜大碗，额度 110、每晚回 20，但吸到的 Token 只顶一半饱。</li><li>前一晚找了谁，第二天其他人会有反应。</li><li>聊天时的回应会被记住：真心话 ♥♥，玩笑话 ♥。第四晚去找的人，如果之前见过、心意攒到 ♥♥♥，会走进那个人的后记；不然就是大家的后记。</li></ol><p>点画面或对白、按 Space / Enter / → 推进文字（一晚读完时，这三个键也能进入下一晚）；选人、回应、补给时可以按数字键 1–4 直接选（贪心和危险的补给仍会再确认）。「跳过已读」直接跳到下一句没读过的话或下一个选择，「自动」按句子长短翻页。Esc 打开存档。</p><p>每一步都会自动保存，另有三份手动档；每晚选人时还会留一份检查点，后记里可以直接回到这一晚重选。导出的 JSON 只含当前局，不含相册。</p><div class="modal-actions"><button data-action="licenses">许可与素材</button></div>');
  }
  function showLog() {
    if (!state) return notify('开始游戏后才能回看已读对白。');
    const rows = replayView(state, view, true);
    let lastSection = '';
    const html = rows.map(row => {
      const section = '第 ' + row.night + ' 晚 · ' + phaseNames[row.phase];
      const label = section === lastSection ? '' : '<h3 class="log-divider">' + esc(section) + '</h3>';
      lastSection = section;
      const name = row.speaker === 'player' ? '你的回应' : speakerName(row);
      return label + '<div class="log-row' + (name ? '' : ' is-narration') + (row.speaker === 'player' ? ' is-choice' : '') + '"><strong>' + esc(name) + '</strong><p>' + esc(row.text) + '</p></div>';
    }).join('');
    openModal('对白回看', '<p class="fine-print">读到哪里，这里就记到哪里。</p>' + html);
    const body = dialog.querySelector('.modal-body');
    body.scrollTop = body.scrollHeight;
  }
  // 存档行写明分支点：第几晚、和谁、到哪一步、饱食多少。
  function describeSave(info) {
    const game = info.state;
    const time = new Date(info.savedAt).toLocaleString('zh-CN');
    if (game.phase === 'ended') return '后记 · 饱食 ' + game.energy + ' · ' + time;
    const who = game.selected ? D.characters[game.selected].name + ' · ' : '';
    return '第 ' + pair(game.night, 4) + ' 晚 · ' + who + phaseNames[info.view.phase] + ' · 饱食 ' + game.energy + ' · ' + time;
  }
  function showSaves() {
    const auto = saveInfo('auto');
    const autoRow = auto && !auto.damaged ? '<div class="save-slot is-auto"><div><strong>自动存档</strong><small>' + esc(describeSave(auto)) + (auto.state.phase === 'ended' ? ' · 已读完' : '') + '</small></div></div>' : '';
    const slots = [1, 2, 3].map(slot => {
      const info = saveInfo('slot' + slot);
      const description = !info ? '空存档' : info.damaged ? '这份存档读不出来，可以直接覆盖' : describeSave(info);
      return '<div class="save-slot"><div><strong>手动档 0' + slot + '</strong><small>' + esc(description) + '</small></div><div class="slot-buttons"><button data-action="save-slot" data-slot="' + slot + '"' + (!state ? ' disabled' : '') + '>保存</button><button data-action="load-slot" data-slot="' + slot + '"' + (!info || info.damaged ? ' disabled' : '') + '>读取</button></div></div>';
    }).join('');
    openModal('存档与读档', '<p>每一步都会自动保存。手动档可以存下分支点，之后回来换个选择；存档、读档都不会动相册。</p><div class="save-slots">' + autoRow + slots + '</div><div class="modal-actions"><button data-action="export-save"' + (!state ? ' disabled' : '') + '>导出当前局 JSON</button><label class="file-button" for="import-save">导入当前局<input id="import-save" data-action="import-save" type="file" accept=".json,application/json" aria-label="导入当前局 JSON"></label></div><p class="fine-print">导出的文件只含这一局的进度，不含相册，换设备时再导入即可（不超过 128 KiB）。读不出来的文件不会影响当前这一局。</p>' + (!storageOK ? '<p class="warning">浏览器未允许本地保存，请使用导出功能。</p>' : ''));
  }
  // 当前还有没读完的一局时，读手动档要先确认，避免误触丢掉进度。
  function requestLoad(slot) {
    if (![1, 2, 3].includes(slot)) return;
    const auto = saveInfo('auto');
    if (auto && !auto.damaged && auto.state.phase !== 'ended') {
      openModal('读取手动档 0' + slot + '？', '<p>当前进度（第 ' + auto.state.night + ' 晚 · ' + esc(phaseNames[auto.view.phase]) + '）会被替换；相册不变。</p><div class="modal-actions"><button data-action="open-saves">先不读取</button><button class="primary" data-action="confirm-load" data-slot="' + slot + '">确认读取</button></div>', '[data-action="open-saves"]');
      return;
    }
    loadSlot(slot);
  }
  function saveSlot(slot, confirmed = false) {
    if (!state || ![1, 2, 3].includes(slot)) return;
    if (!confirmed && readStorage('slot' + slot)) {
      openModal('覆盖手动档 ' + slot + '？', '<p>只替换这一份手动档，其他存档与收藏不变。</p><div class="modal-actions"><button data-action="open-saves">先不覆盖</button><button class="primary" data-action="confirm-save" data-slot="' + slot + '">确认覆盖</button></div>');
      return;
    }
    const ok = writeStorage('slot' + slot, makePack());
    showSaves();
    notify(ok ? '已保存到手动档 ' + slot + '。' : '保存失败，请改用导出。');
  }
  function loadSlot(slot) {
    if (![1, 2, 3].includes(slot)) return;
    const raw = readStorage('slot' + slot);
    assert(raw, '该位置没有存档。');
    loadPack(raw);
    notify('已回到手动档 ' + slot + '。收藏保持不变。');
  }
  function exportSave() {
    if (!state) return;
    const url = URL.createObjectURL(new Blob([makePack()], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'four-nights-v4-night-' + state.night + '.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('已导出当前局；JSON 不含全收藏。');
  }
  async function importSave(input) {
    const file = input.files?.[0];
    if (!file) return;
    try {
      assert(file.size > 0 && file.size <= maxBytes, '完整文件须不超过 128 KiB。');
      const text = await file.text();
      loadPack(text);
      notify('存档已通过引擎与阅读重放验证。收藏保持不变。');
    } catch (error) { notify('没有载入：' + error.message); }
    finally { input.value = ''; }
  }
  function showGallery(toEndings = false) {
    const endingHints = { hunger: '饱食归零的那一晚', household: '第四晚去找的人，心意还不够' };
    const endings = '<h3 class="gallery-section">已见结局 ' + endingsSeen.length + ' / ' + endingIds.length + '</h3><ul class="ending-list">' + endingIds.map(id => {
      const seen = endingsSeen.includes(id);
      const hint = endingHints[id] || '第四晚去找 ' + D.characters[id].name + '，之前见过、心意够';
      return '<li class="' + (seen ? 'is-seen' : '') + '"><strong>' + (seen ? esc(D.endings[id].title) : '？？？') + '</strong><small>' + esc(hint) + '</small></li>';
    }).join('') + '</ul>';
    openModal('回忆相册', '<p>已收藏 ' + collection.length + ' / 12 张夜晚的画面。读到补给场景时收进这里，新开一局也不会丢。</p><div class="gallery-grid">' + cgKeys.map((key, index) => {
      const unlocked = collection.includes(key);
      const split = key.lastIndexOf('_');
      const id = key.slice(0, split);
      const mode = key.slice(split + 1);
      const hidden = C.constants.characters[id].hidden;
      return '<button class="gallery-card' + (unlocked ? ' unlocked' : '') + '" data-action="gallery-image" data-key="' + key + '"' + (!unlocked ? ' disabled' : '') + '>' + (unlocked ? image(key, 'gallery-thumb', '已收藏的事件图', id) : '<span class="locked-art" aria-hidden="true">' + (hidden ? '？' : '—') + '</span>') + '<span class="eyebrow">片刻 ' + String(index + 1).padStart(2, '0') + '</span><strong>' + esc(D.characters[id].name + ' · ' + modeNames[mode]) + '</strong>' + (unlocked ? '' : '<small class="gallery-hint">' + (hidden ? '需先让零注意到' + pronoun(id) : '还没见过') + '</small>') + '</button>';
    }).join('') + '</div>' + endings);
    if (toEndings) {
      const section = dialog.querySelector('.gallery-section');
      section.tabIndex = -1;
      section.scrollIntoView({ block: 'start' });
      section.focus({ preventScroll: true });
    }
  }
  function showGalleryImage(key) {
    if (!collection.includes(key) || !cgKeys.includes(key)) return;
    const id = key.slice(0, key.lastIndexOf('_'));
    openModal('回忆画面', '<div class="gallery-view">' + image(key, 'gallery-full', '已收藏的事件插图', id) + '<p class="gallery-caption">' + (failedAssets.has(key) ? '本地未找到这张事件图，暂用人物图代示。' : '读到过的一晚。这是事件图，不是新增结局图。') + '</p></div><div class="modal-actions is-sticky"><button data-action="open-gallery">回到相册</button></div>');
  }
  function routeAction(button) {
    if (button.disabled) return;
    const action = button.dataset.action;
    switch (action) {
      case 'new-game': requestNew(); break;
      case 'confirm-new': startNew(); break;
      case 'continue-auto': { const raw = readStorage('auto'); assert(raw, '没有自动存档。'); loadPack(raw); break; }
      case 'next': nextLine(); break;
      case 'toggle-ui': toggleSceneUI(); break;
      case 'select-person': case 'invite': selectPerson(button.dataset.id); break;
      case 'skip-read': skipRead(); break;
      case 'toggle-auto': toggleAuto(); break;
      case 'retry-night': retryNight(Number(button.dataset.night)); break;
      case 'toggle-retry': retryOpen = !retryOpen; render(); break;
      case 'choose': choose(Number(button.dataset.index)); break;
      case 'pick-mode': pickMode(button.dataset.mode); break;
      case 'confirm-fatal': case 'confirm-mode': if (pendingMode) executeMode(pendingMode); break;
      case 'cancel-fatal': case 'close-dialog': closeModal(); break;
      case 'advance-night': advanceNight(); break;
      case 'open-saves': showSaves(); break;
      case 'save-slot': saveSlot(Number(button.dataset.slot)); break;
      case 'confirm-save': saveSlot(Number(button.dataset.slot), true); break;
      case 'load-slot': requestLoad(Number(button.dataset.slot)); break;
      case 'confirm-load': loadSlot(Number(button.dataset.slot)); break;
      case 'export-save': exportSave(); break;
      case 'open-gallery': showGallery(); break;
      case 'open-endings': showGallery(true); break;
      case 'gallery-image': showGalleryImage(button.dataset.key); break;
      case 'open-log': showLog(); break;
      case 'profile': showProfile(button.dataset.id); break;
      case 'help': showHelp(); break;
      case 'licenses': openModal('美术、品牌与代码许可', document.getElementById('license-notice').innerHTML); break;
      case 'home': stopAuto(); autoSave(); onCover = true; render(); closeModal(); break;
      default: break;
    }
  }
  // 点画面或对白框里的空白处推进一句（按钮之外）；纯看画面时点画面恢复对白。选择、选人、补给阶段 nextLine 自己会拒绝。
  function stageClick(event) {
    if (dialog.open || onCover || !state || event.button !== 0 || event.defaultPrevented) return;
    if (!event.target.closest?.('.novel-stage .scene-frame, .novel-stage .dialogue-copy, .novel-stage .dialogue-bottom')) return;
    if (event.target.closest('.reading-tools')) return;
    if (String(window.getSelection?.() || '').trim()) return;
    try {
      if (uiHidden) toggleSceneUI();
      else nextLine();
    } catch (error) { notify('这一步没有执行：' + error.message); }
  }
  // 数字键：选人按邀请顺序，回应按 01/02，补给按 浅尝 / 深补 / 贪心；贪心与危险补给照样弹确认。
  function pickByNumber(number) {
    if (onCover || !state || uiHidden) return false;
    if (view.phase === 'select') {
      const id = ids.filter(other => !unseenFor(other) && C.preview(state, other, 'greedy').allowed)[number - 1];
      if (!id) return false;
      selectPerson(id);
      return true;
    }
    if (view.phase === 'choice' && number <= 2) { choose(number - 1); return true; }
    if (view.phase === 'mode' && number <= modes.length) { pickMode(modes[number - 1]); return true; }
    return false;
  }
  // 键盘推进：一晚读完时 Space / Enter / → 直接进入下一晚，不用 Tab 六次找按钮。
  // 焦点在按钮上时 Space / Enter 交给按钮自己（不会翻两次）；刚读完的半秒里不翻页，连按不会跳过「明晚」提要。
  function proceed() {
    try {
      if (!onCover && state && !uiHidden && !dialog.open && view.phase === 'morning' && view.cursor === readingLines(state, 'morning').length) {
        if (performance.now() >= tapGuardUntil) advanceNight();
        return;
      }
      nextLine();
    } catch (error) { notify('这一步没有执行：' + error.message); }
  }
  document.addEventListener('pointerdown', event => { lastPointer = event.pointerType || 'mouse'; }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) { stageClick(event); return; }
    if (dialog.open && !dialog.contains(button)) return;
    // 触屏连点：刚换阶段或刚弹出确认框时，落在新选项上的点按不生效（「下一句」、取消与关闭不受限）；
    // 被拦下的点按会把保护再延长半秒，手指停一下再点才算数，连点多快都不会一路点进贪心确认。
    const pointer = typeof event.pointerType === 'string' && event.pointerType ? event.pointerType : event.detail > 0 ? lastPointer : 'keyboard';
    if ((pointer === 'touch' || pointer === 'pen') && performance.now() < tapGuardUntil && !['next', 'toggle-ui', 'close-dialog', 'cancel-fatal'].includes(button.dataset.action)) {
      tapGuardUntil = performance.now() + 500;
      return;
    }
    try { routeAction(button); } catch (error) { notify('这一步没有执行：' + error.message); }
  });
  document.addEventListener('change', event => { if (event.target.id === 'import-save') importSave(event.target); });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing || dialog.open) return;
    const active = document.activeElement;
    const typing = active?.closest('input, select, textarea, [contenteditable="true"]');
    // Esc 和 → 不会「点」到焦点所在的按钮，所以焦点停在工具按钮上时也照样生效。
    if (event.key === 'Escape') { if (!typing) { event.preventDefault(); showSaves(); } return; }
    if (event.key === 'ArrowRight' && !typing && !onCover) { event.preventDefault(); proceed(); return; }
    if (!typing && /^(?:Digit|Numpad)[1-4]$/.test(event.code)) {
      try { if (pickByNumber(Number(event.code.slice(-1)))) event.preventDefault(); }
      catch (error) { notify('这一步没有执行：' + error.message); }
      return;
    }
    if (active?.closest('button, a, input, select, textarea, summary, [contenteditable="true"]')) return;
    if (event.code === 'Space' || event.key === 'Enter') { event.preventDefault(); proceed(); }
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
    const controls = [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter(element => !element.disabled && element.tabIndex >= 0 && !element.closest('[inert]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); dialog.focus(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal();
  });
  window.addEventListener('beforeunload', autoSave);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) inspectImages(); });

  Object.defineProperty(window, 'FourNightsUI', { value: Object.freeze({
    getState: () => state ? clone(state) : null,
    getView: () => clone(view),
    validateView
  }), writable: false, configurable: false });
  render();
}());
