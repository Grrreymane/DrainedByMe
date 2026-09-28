# 四晚架构与规则说明

TOKEN / AFTERHOURS · 《完蛋，我被 Agent 包围了》 · v0.3.0

基线：2026-09-27。本文对照 `src/engine/core.js`、`src/data/story.js`、`src/ui/app.js` 和 `src/ui/styles.css`。程序版本 0.3.0；现行规则为 **v4**，存档格式同步为 v4（引擎 `four-nights-v4`、UI `token-four-nights-v4`）。源码实现、图片制作与最终验收分开，旧报告不能作为本版测试证据。

## 1. 模块与边界

HTML / CSS / JavaScript 本地游戏，无真实模型调用、账户、云后端或真实 Token 扣费。引擎不访问 DOM、时钟、随机数、网络或 localStorage。

| 路径 | 当前职责 |
| --- | --- |
| `src/engine/core.js` | 独立纯规则，CommonJS 或浏览器全局 `AfterhoursCore`；不加载剧情 |
| `src/data/story.js` | 四晚开场与 `openings`，Codex、Claude 各四次来访，Cursor、WorkBuddy 各两次来访，三档补给与六结局；UMD 导出 `AfterhoursStory` |
| `src/ui/app.js` | 纸面封面、初版三栏视觉骨架、逐句阅读、选人/回应/补给、纯看画面、浏览器存档、回看与事件 CG 收藏 |
| `src/ui/styles.css` | 米白纸纹、红棕强调、封面粉色花卉线、场景与对白连体卡、渐进披露右栏、48px 控件、窄屏重排与减弱动效 |
| `src/assets/` | 四张母版驱动的真实 RGBA 透明立绘、一张公寓背景、十二张独立事件图（其中十一张为 2026-09-27 的 visual-v8，`claude_deep` 保留用户原稿场景）和一张 LightAI 封面；十八图均已审看 |
| `scripts/` | 本地开发服务、构建、静态验证、源码包；入口保持不变 |
| `tests/` | 已有四晚规则、存档、六结局等 Node 用例与浏览器回归入口；文件存在不代表本版验收通过 |
| `outputs/` | 本地生成产物；旧文件不代表当前源码已构建验收 |

UI 启动前须已有 `AfterhoursCore` 和 `AfterhoursStory`。核心常量与 API 对象冻结；操作克隆状态并返回新状态，调用方须接收返回值。UI 不另写资源结算规则，所有补给按钮共用 `C.preview`。

## 2. 引擎状态与 API

初始状态：`version=4`、`night=1`、`phase='select'`、`energy=28`，`selected/choice/lastResult/endingId=null`，历史为空。四人初始额度等于第一晚容量，`visits/affinity/blockedNight/resets=0`。

| 字段 | 语义 |
| --- | --- |
| `night` | 当前第 1–4 晚；在 `advance` 时才增加 |
| `phase` | `select / talk / mode / result / ended` |
| `energy` | 0–60，UI 显示为饱食；同一状态值越低越危险 |
| `characters[id]` | `tokens/cap/visits/affinity/blockedNight/resets` |
| `selected` / `choice` | 所选角色、回应索引 0 或 1；下一晚重置为空 |
| `actions` | 可重放的 `select/choose/commit/advance` 白名单操作，最多 16 次 |
| `history` | 每次补给结算的结果，最多四条，不记录读文字 |
| `lastResult` | `night/character/mode/choice/cost/feed/energyBefore/energyAfter/wasted/visit/blockedNextNight/resetNextNight` |
| `endingId` | 未结局为空，结束时为六个合法 ID 之一 |

| API | 前置与行为 |
| --- | --- |
| `createState()` | 创建初始状态 |
| `select(state, id)` | 仅 `select` 阶段；角色未隐藏、未在本晚锁定且 Token >0，进入 `talk` |
| `choose(state, index)` | 仅 `talk` 阶段；接受 0 或 1，进入 `mode`，不立即改变资源 |
| `preview(state, id, mode)` | `select/talk/mode` 阶段只读预览；无效阶段或参数返回不可执行原因 |
| `commit(state, mode)` | 仅 `mode` 阶段；对当前 `selected` 重新调用预览，结算补给与关系，进入 `result` |
| `advance(state)` | 仅 `result` 阶段；检查饥饿、第四晚结局或进入下一晚并恢复额度 |
| `validateState(state)` | 字段与值域校验，重放全部合法操作并比对完整派生状态，返回克隆 |
| `serialize(state)` | 校验并输出引擎 JSON 字符串 |
| `deserialize(text)` | 限制文本与字节、解析、验证格式并重放 |
| `unlocked(state)` | Codex 与 Claude 是否都已被贪心吸空过一次（Cursor、WorkBuddy 由此解锁） |
| `capFor(id, night)` / `drainFor(night)` | 某人某晚的容量、某晚的夜耗 |
| `constants` / `ids` | 四晚参数、成本、夜耗、各人容量/恢复/重置/隐藏/顶饱系数与四人 ID |

`preview` 返回 `allowed/reason/cost/feed/drain/wasted/energyAfter/fatal/warning/tokensAfter/blockedNextNight/resetNextNight`。UI 使用可执行性与原因禁用按钮；实际提交不信任过期预览。`commit` 本身不处理 UI 弹窗，致命选择或贪心的额外确认由 app 强制完成。

旧 API `applyChoice/act/useReset/getEnding` 已不属于现行导出；没有 `progress/fatigue/harmony/coupon` 或任务专长、校准参数。

## 3. 补给与跨晚结算

规则 v4，数值以 `src/engine/core.js` 的 `constants` 为准：

| 参数 | 值 |
| --- | --- |
| 晚数 | 4 |
| 初始 / 最大饱食 | 28 / 60（`initialEnergy` / `maxEnergy`），超过 60 的部分溢出浪费 |
| 四晚夜耗 | 20 / 25 / 30 / 35（`drains`，零一晚比一晚饿） |
| 浅尝 `shallow` | 固定消耗 10 |
| 深补 `deep` | 固定消耗 26 |
| 贪心 `greedy` | 消耗所选人当前全部 Token |

| 角色 | 容量（第 1–4 晚） | 每晚恢复 `regen` | 全局重置 `resets` | 初始隐藏 | 顶饱系数 `nourish` |
| --- | --- | --- | --- | --- | --- |
| Codex | 90 / 90 / 90 / 90 | 0（每晚不回） | 1 次 | 否 | 1 |
| Claude | 30 / 38 / 46 / 54 | 100（每晚回满） | 0 | 否 | 1 |
| Cursor | 55 | 12 | 0 | 是 | 1 |
| WorkBuddy | 110 | 20 | 0 | 是 | 0.5（便宜大碗，只顶一半饱） |

Cursor 与 WorkBuddy 在 `unlocked(state)` 为真之前隐藏：Codex 与 Claude 都要在历史里各有一次贪心。隐藏角色不能选择或预览为可执行。

固定档位要求 **`tokens > cost`**，等于成本也不可执行；只有贪心允许清零。全部模式都要求角色未隐藏、本晚未被锁定且额度大于 0。

一次 `commit`：

1. 用 `preview` 再检查当前所选人的模式可执行性。
2. 扣所选人 Token；若贪心，设为 0。贪心时若此人还有全局重置次数（只有 Codex，一次），`resets +1`、`resetNextNight=true`，不锁下一晚；否则设置 `blockedNight = night + 1`。
3. `visits +1`，`affinity += 1 + (choice === 0 ? 1 : 0)`。
4. `feed = floor(cost × nourish)`；`energy = clamp(原 energy + feed − drain(night), 0, 60)`，`wasted = max(0, 原 energy + feed − drain − 60)`。
5. 写入 `lastResult` 与 `history`，阶段变为 `result`，晚数不变。

**Token=0 只锁下一晚，隔晚恢复。** `advance` 进入下一晚时逐人处理，先把 `cap` 更新为新一晚容量：

- 若 `blockedNight === 新 night`，保持 Token 为 0；这一晚不可选。
- 否则若 Token 为 0（锁定已过，或 Codex 用掉全局重置），恢复到 `cap`。
- 其他人恢复 `min(cap, tokens + regen)`：Codex 不回，Claude 回满，Cursor +12，WorkBuddy +20。

例如 Codex 第一晚被贪心，用掉全局重置，第二晚直接回满 90、可选；之后再被贪心就要休息一晚。其他人第一晚贪心，第二晚锁定，第三晚回满。第三晚贪心会锁第四晚；第四晚贪心后的休息落在可玩流程之外，不生成第五晚。

饱食 `<=10` 预警，`<=0` 为致命选择；UI 允许取消或确认进入轻量饥饿失败。第一晚贪心 Codex 也只能填到 60（溢出 38），后面几晚仍要继续进食。玩家饱食与角色 Token 不等价，不能互相推导全员耗尽。

## 4. 六结局精确优先级

结局只在 `advance` 中判断；`commit` 后无论第四晚或饥饿，仍先处于 `result` 供 UI 阅读。

| 顺序 | 条件 | 结果 |
| --- | --- | --- |
| 1 | `energy <=0` | `ended`，`endingId='hunger'` |
| 2 | `energy >0` 且 `night===4`，最后所选人的 `visits>=2 && affinity>=3` | `ended`，`endingId=selected`，四人之一 |
| 3 | 第四晚且未满足上项 | `ended`，`endingId='household'` |
| 其余 | 尚未到第四晚 | 恢复额度、清空选人与回应，进入下一晚 `select` |

只检查最后所选人，不按全员亲近值排序。`household` 不要求四人都访问过；个人后记不要求四次来访全部读完。六个 ID 为 `hunger/household/codex/claude/cursor/workbuddy`，没有旧九结局的额外分支或进度门槛。

## 5. Story 分流与 UI 阅读状态机

Story 结构为 `title/characters/intro/nights/openings/routes/supplements/repeatSupplements/morning/returnLines/endings/cgMap/sources`。`nights` 四项；`openings` 含 `after`（前一晚找了谁，其他人的反应）、`codexReset`（Codex 全局重置）和 `unlock`（零第一次想起另外两人）；`routes` 为 Codex、Claude 各四项，Cursor、WorkBuddy 各两项，每段 `title/lines/choices`，两个选择分别为 `label/reply`。对白行使用 `speaker/text`。

| core phase | 允许的 UI phase |
| --- | --- |
| `select` | `intro / common / select` |
| `talk` | `visit / choice` |
| `mode` | `reply / mode` |
| `result` | `supplement / morning` |
| `ended` | `ending` |

完整 UI 流程为 `intro → common → select → visit → choice → reply → mode → supplement → morning → common / ending`。晨间读完会停留等待“进入下一晚/阅读后记”；结局读完显示收束操作，不自动消耗额度或跳到下一晚。

- 个人场景由补给前的 `characters[selected].visits` 索引，不由 `night` 索引。
- `visitLines` 找此人最近一次历史：贪心且已隔至少两晚优先 `afterGreedy`；否则紧邻前晚用 `consecutive`；其他旧来访用 `switched`；首次无问候。
- 正常补给：更早夜晚有同一人同一模式时用 `repeatSupplements`，否则用 `supplements`；当前历史结果不参与“此前用过”判断。
- Claude 用户稿位于 `src/data/story.js` 的 `supplements.claude.deep`，只用于首次深补；重复深补走 `repeatSupplements.claude.deep`。这不是待接入接口，本次不重引或修改正文。
- 正常晨间：`morning[lastResult.character][lastResult.mode]`，不预测下一晚选人。
- 致命结算：app 的 `readingLines` 替换成补给不足的虚弱文本，不使用正常补给/晨间、正常事件 CG。

UI `view={phase,cursor,readCount}`。`replayView` 从初始状态重放引擎操作和阅读步骤，确认前置对白已读、阶段相容、游标可达；阅读计数最大 12000。只改 `phase/cursor` 不能伪造已读进度。回看从相同重放重建，不接受外部 backlog。

当前 UI 暴露只读测试接口 `window.FourNightsUI.getState/getView/validateView`，前两项返回克隆；无随意写状态的测试后门。

### 纸面三栏舞台与纯看画面

- `coverScreen` 使用米白纸面、红棕标题、粉色花卉线和四人错落群像；不使用全屏背景照片，也不复刻参考作品的角色、标题或具体构图。四个 `.cover-person` 保留人物资料入口。
- `gameScreen` 以初版视觉为母版，桌面采用“左角色名册 / 中央场景与对白连体卡 / 右当前上下文”三栏。夜数、夜晚标题与饱食合并进游戏页顶栏（`header.is-game` 内的 `night-status`），游戏页不再渲染页脚与独立 session bar。左栏为头像、Token 条与休息状态；右栏阅读时显示当前人物卡、本晚结算与四晚手记，只有 `mode` 阶段换成三档精确数字，不恢复旧版任务、交付、疲劳和默契信息。
- `sceneArtwork` 与 `dialogue` 上下相接，事件 CG 不被对白覆盖。桌面端 `.story-card` 按可用视口高度收窄宽度，使 16:9 画面与对白同屏、无需滚动；小于 1000px 时改为单列：阅读时场景对白在最前，补给阶段三档紧跟对白，选人阶段名册移到最前；小于 760px 时顶栏只留夜数与饱食。长对白与 200% 字号自然增高。
- 立绘取景：`styles.css` 为四张立绘记录实测的眼线 `--eye`、头长 `--head` 与脸中心 `--cx`（按 `img[data-asset]` 选择），各容器用 `--frame-eye/--frame-head` 指定眼线与头长占容器高的比例；场景、名册头像、右栏人物卡和资料弹窗共用这套定位。更换立绘时必须重新量这三个值。
- `toggleSceneUI` 仅切换临时 `uiHidden`、舞台 `ui-hidden` 类、按钮文案/`aria-pressed`，并同步设置 `dialogue/selection-panel/context-panel` 的 `inert/aria-hidden`；不调用 core、`commitUI` 或 `autoSave`，不修改 state、view.cursor、readCount、actions 或 Token。
- `nextLine` 在 `uiHidden` 时直接返回。隐藏面板不可聚焦或激活，Space/Enter 不推进对白；恢复按钮沿用原生键盘激活，恢复后保留原阅读位置。`uiHidden` 不加入存档包。
- CSS 使用 48×48 最小控件、本地系统字体、内联 SVG 与 `prefers-reduced-motion`；小屏改为顺序布局并保留完整文字。事件图及相册 `object-fit: contain`，背景可 `cover`；CSS 的 16:9 容器不能代替源图实际像素比例。

## 6. v4 存档与旧档隔离

### 引擎格式

`serialize` 输出 `{ format: 'four-nights-v4', state: ... }`，其中 `state.version=4`。校验精确字段、普通对象/数组原型、整数范围、模式、结果、角色容量与合法操作；拒绝未知键、危险原型键、访问器、符号键、隐藏字段及稀疏列表。重放只执行白名单操作，最后比对全部派生状态。

`deserialize` 先限制字符串长度不超过 131072 个 UTF-16 码元，再检查 UTF-8 字节大小不超过 128 KiB；两项必须同时满足，不能混淆计量单位。解析失败或不支持的格式直接拒绝。v1–v3 旧档（数值规则不同）不兼容，core 有明确旧版本错误提示。

### UI 完整档

完整 UI 包为 `{ format: 'token-four-nights-v4', version: 4, savedAt, engine, ui }`：`engine` 是上述序列化字符串，`ui` 是阅读位置。引擎 JSON 不是 UI 文件，不能直接在存档菜单导入。

app namespace 为 **`token-four-nights-v4`**，localStorage 使用：

- `token-four-nights-v4.auto`；
- `token-four-nights-v4.slot1/slot2/slot3`；
- `token-four-nights-v4.night1`–`night4`（每晚选人时的检查点，后记里可回到这一晚重选）；
- `token-four-nights-v4.collection`、`.endings`（已见结局）、`.read`（已读对白，供跳过已读）。

`token-four-nights-v4.collection` 为空时，只读沿用 `token-four-nights-v3.collection` 已解锁的事件图，不改写旧记录；v3 自动档只用于提示旧档不兼容。

**旧 v1–v3 存档不迁移、不覆盖；旧档不能继续 v4，须开始新局。** 当前 UI 存档格式/版本提示明确只支持 v4。其他结构错误也可能先被字段校验拒绝，不承诺所有坏档都显示同一句提示。

导入先检查 `file.size`，再检查完整 JSON 文本 UTF-8 大小不超过 128 KiB；验证时间字段、引擎文本与 UI 阅读重放成功后才替换当前局。失败保留当前局。

每次阅读推进或规则操作后自动保存，离开前也尝试保存。手动覆盖须确认；新局替换自动档，不清除三个手动档或图片收藏。浏览器拒绝存储会提示，仍允许游玩和导出。

`file://` 与本地 HTTP、不同文件位置及不同浏览器不保证共享存储，显式导出导入用于迁移。**导出仅当前局和阅读位置，不包括其他槽位或全收藏。**

## 7. 事件图、收藏与声音

事件图键为 `cgMap[id][mode] = id + '_' + mode`。正常 `supplement` 显示对应事件图；非饥饿 `ending` 可复用最后一次事件图，并标明不是新增结局图。图片加载失败退回该角色 portrait，显示“代示”，不据此宣称已有 CG。

收藏保存为 `{version:2,cgs:[...]}`，独立于当前局。只有正常补给阶段、图片已经成功载入、在可视区域且无弹窗遮挡等检查通过时才解锁；调用 `commit` 本身不解锁。读档不清空收藏；导入结局档不会自动填满收藏，导入到正常补给场景后仍须实际载入可见图片。

资产制作约定：四 portrait 全部独立重绘为 2:3 角色图，通过 LightAI skill `_common.create_async_task` 调用 nano-banana pro / `gemini-3-pro-image-preview`；再逐张以 `BiRefNet-HR-matting` 独立去背景（`expand=-1`、`blur_radius=0.5`），透明 PNG 经 Pillow 保留 Alpha 转 WebP。十二事件逐张以 2K 档、16:9 独立生成，不再三联裁切；另绘一张 16:9 公寓背景。加上独立封面，现行运行时为 **四立绘＋十二事件＋一背景＋一封面＝十八项**。visual-v7更新Codex/WorkBuddy两张自然动作立绘及十二CG，WorkBuddy严格按母版保留少量浅淡短胡；封面CSS、Claude/Cursor立绘、背景与剧情规则不改。十二新CG以整图等比容纳到2560×1440，不裁边。

**visual-v8（2026-09-27）**：按 v3/v4 新剧情重画十一张事件图——`codex_shallow/deep/greedy`、`claude_shallow/greedy`、`cursor_shallow/deep/greedy`、`workbuddy_shallow/deep/greedy`；`claude_deep` 与用户原稿场景一致，保留 v7 成品。仍经 LightAI skill 调用 nano-banana pro，16:9、2K 档，每键独立生成，必要时做图像编辑修正；方向为有温度但全程穿好衣服的成年亲近。源图 2752×1536 整图等比缩到 2560×1429，上下各约 5 像素以镜像边缘补齐到 2560×1440（`codex_greedy` 为去掉模型自绘边框后两侧各修 32 像素背景），RGB WebP quality 93、method 6。十八项运行时资产的尺寸、摘要、Alpha 与十一张新图的审看要点见 `outputs/visual-v8-qa.json`；被替换的 v7 成品另存于 `_archive/2026-09-27/src-assets-v7/`（不入库）。2K请求档位不等于实际像素尺寸。

这是离线制作链，不是游戏运行时依赖。pipeline 响应和签名 URL 只留 `.cache/`，不得进入源码包、离线 HTML 或可分发清单；项目外技能不复制入库。来源不代表厂商/画师官方创作、授权、合作或商业无忧，权利边界仍见 `ASSET-LICENSE.md`。

当前 app **没有音频播放或音效开关**，也没有文字速度设置。阅读工具有回看、跳过已读（停在第一句没读过的话、选择或一晚结尾）和按句子长短翻页的自动播放；每晚选人时存一份 `night1`–`night4` 检查点，结局可回到本局任一晚重选。人物在故事中看片、听歌不表示加载对应音视频文件。

## 8. 输入、安全与本地工具

Space / Enter / → 与点击对白框空白处推进可读对白；一晚读完时这三个键也进入下一晚（读完后半秒内忽略，避免连按跳过次日摘要）。数字键 1–4 在选人、回应、补给阶段直接选择，贪心与致命补给仍弹确认。纯看画面时 `nextLine` 阻止推进；已有交互控件焦点时保留原生行为。手机上新出现的选项要等手指停顿约半秒才接受点击，防止连点误吸。隐藏面板通过 `inert` 禁止焦点与激活，恢复按钮不消耗资源或改变阅读游标。Esc 关闭弹窗；无弹窗且焦点不在交互控件时打开存档。阶段切换后焦点落到新标题（`#select-heading`、`#choice-heading`、`#mode-heading`、`#page-end`、`#ending-title`）。旧 S/L、M/H 快捷键不在现行实现中。

弹窗用原生 dialog，记录稳定选择器以恢复重绘后的焦点；贪心/致命确认默认聚焦取消。导入数据作为数据解析，文字经过转义；本地图片 URL 只接受允许的 data 图像或项目相对路径。以上是代码机制描述，不代表完整安全或无障碍审计。

Node.js >=20，沿用原 npm scripts：

| 命令 | 职责 |
| --- | --- |
| `npm run dev` | `scripts/serve.mjs --port 4173`，仅监听 `127.0.0.1` |
| `npm test` | `node --test tests/*.test.cjs` |
| `npm run build` | `scripts/build.mjs`，游戏与设计产物 |
| `npm run verify` | `scripts/verify.mjs`，静态发行检查 |
| `npm run check` | 测试 → 构建 → 静态检查，不含浏览器回归 |
| `npm run test:e2e` | `tests/browser.cjs`，已有 playwright-core 与浏览器环境 |
| `npm run package` | `scripts/package.mjs`，本地源码打包，不上传 |

`PLAYWRIGHT_MODULE` 可指定现有浏览器测试模块，`BROWSER_CHANNEL` 可指定浏览器通道。不要在文档或发行包写本机安装路径。游戏运行不依赖这些浏览器测试模块。

## 9. 验证边界

现行快照已接入四张母版驱动透明立绘和一张独立 LightAI 封面；连同客厅与十二事件图共十八项。最终构建、测试与打包必须在全部输入冻结后执行。

最终验收在源码、文档与素材冻结后针对同一快照完成，特别检查：

- 四晚六结局、固定模式不可清零、贪心只锁下一晚及隔晚恢复；
- 初次/重复补给、动态次日与重返、第四晚与致命结果先读后结局；
- v4 存档往返、v1–v3 旧档隔离、手动覆盖、导入失败原子性与独立收藏；
- 纯看画面切换前后的 state、cursor、readCount 和花费不变，隐藏时键盘不跳读、不触发选择；
- 四立绘真实 Alpha：逐张 Alpha=0 透明像素 >=12%，且保有 Alpha=255 实体与完整主体；检查 PNG 与 WebP 转换前后，不接受 CSS 伪透明；
- 十二事件独立生成、实际尺寸逐张 >=1600×900 且 `width × 9 === height × 16`，背景为新 16:9 单图，不能以 CSS 拉伸满足标准；
- 十八项清单、完整解码、内嵌字节/摘要、离线图片、48px 控件、焦点、小屏、存储降级和许可附录；
- 白名单源码包不带 `.cache/`、pipeline 响应、签名 URL 或外部技能。

`scripts/build.mjs` 的 manifest 当前只记录版本、资产字节/摘要/MIME 与产物和文档快照，不记录源图尺寸或 Alpha。像素、Alpha 与资产键的现行关联记录见 `outputs/visual-v8-qa.json`；2K 请求档位不作为实际尺寸证据。

现行素材尺寸、Alpha 与审看记录见 `outputs/visual-v8-qa.json`（此前批次见 `outputs/visual-v7-qa.json`）；最终文件哈希、ZIP 大小及测试结论以 `outputs/release-qa.json`、`outputs/browser-qa.json`、`outputs/verification.json` 为准。不提前宣称最后打包成功，不沿用旧报告。技术验收与授权审查分开；当前无 Git 仓库，不初始化、提交、推送、部署或公开发布。
