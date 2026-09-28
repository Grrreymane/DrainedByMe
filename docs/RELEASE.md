# 本地构建与发行 · v0.3.0 Gal 重制版

记录日期：2026-09-27。程序版本 **0.3.0**，规则 **v4**，存档格式 **v4**（引擎 `four-nights-v4`、UI `token-four-nights-v4`）；程序版本与规则/存档编号不可混用。现行数值与结算公式见 [架构与规则](ARCHITECTURE.md) 第 3 节。

2026-09-27 更新：规则 v4（饱食上限 60、夜耗 20/25/30/35、WorkBuddy 只顶一半饱）、界面修整，以及 visual-v8 重画的十一张事件 CG（`claude_deep` 保留用户原稿场景）。此前 visual-v7 完成 Codex/WorkBuddy 自然动作立绘，WorkBuddy 严格按母版保留少量浅淡短胡。最终发行按本文顺序冻结输入、构建与复验；**与交付文件匹配的实际测试数量、摘要和源码包结果以 `outputs/visual-v8-qa.json`、`outputs/asset-manifest.json`、`outputs/verification.json`、`outputs/browser-qa.json` 与最新源码包为准，不沿用上一快照通过数**。

## 1. 现行实现

- 四晚合租流程；Codex、Claude 各四次个人来访，Cursor、WorkBuddy 要等 Codex 与 Claude 都被吸空过一次才出现，各两次来访。三档初次/重复补给、动态次日、前一晚选人引起的开场反应及重访问候；个人访问次数不等于夜晚序号。
- 贪心将所选角色额度清零，只锁下一晚，隔晚满额恢复；Codex 第一次被吸空改为全局重置、次晚回满不休息。固定档位不能清零。饱食上限 60，溢出浪费；夜耗逐晚 20/25/30/35；WorkBuddy 的 Token 只顶一半饱。补给与晨间先供阅读，再手动推进下一晚或后记。
- 六结局为 `hunger/household/codex/claude/cursor/workbuddy`；第四晚存活时检查最后所选人的 `visits >= 2 && affinity >= 3`。
- Claude 用户稿已接入 `supplements.claude.deep` 首次深补，本轮美术/UI 改造没有改写该稿。
- UI 恢复初版的米白纸面、红棕强调和“左名册 / 中央场景对白 / 右决策栏”结构，同时按四晚玩法删去旧任务、交付、疲劳与默契信息。封面使用 LightAI 依据已确认角色母版和构图参考生成的独立主视觉，HTML 叠加真实标题；场景和对白上下相接，不覆盖 CG。纯看画面同步隐藏名册、上下文和对白面板，不改变 state、cursor、readCount 或花费；隐藏时键盘不会跳读。
- 本地系统字体、内联 SVG、窄屏重排、减弱动效。有回看、跳过已读和自动播放；没有音频播放、文字速度设置或旧版校准功能。

## 2. 美术完成情况

**24 项运行时资产**：4 张透明角色立绘、12 张独立事件 CG、6 张结局 CG、1 张公寓背景、1 张独立封面。六张结局 CG 为 2026-09-27 的 visual-v9 新增，审看记录见 `docs/design/art-log.md` 第 7 节。全部已进行图像与界面合成审看。2026-09-27 的 visual-v8 替换了其中十一张事件 CG（除 `claude_deep` 外全部），源图同为 2752×1536、成品 2560×1440 RGB WebP；逐图摘要与审看要点见 `outputs/visual-v8-qa.json`，被替换的 v7 成品另存于 `_archive/2026-09-27/src-assets-v7/`。

| 类型 | 数量 | 实际源尺寸 | 游戏内成品 |
| --- | --- | --- | --- |
| 四人立绘 | 4 | 1696×2528 | 1120×1680，RGBA WebP |
| 事件 CG | 12 | 2752×1536 | 2560×1440，精确 16:9 |
| 公寓背景 | 1 | 2752×1536 | 2560×1440，精确 16:9 |
| 封面主视觉 | 1 | 2752×1536 | 2560×1440，精确 16:9 |

- 按用户指定流程，经 LightAI 调用 `gemini-3-pro-image-preview`；四张现行立绘以 `portraits-base-style-fixed.png` 为共同母版分别生成，封面以该母版与构图参考独立生成。
- 四张立绘各自通过 `BiRefNet-HR-matting` 去背景，参数 `expand=-1`、`blur_radius=0.5`；透明 PNG 裁掉多余空边、等比缩小后排入透明画布。不是 CSS 去白或混合模式。兽耳角色无额外人耳，WorkBuddy 保留短胡。
- visual-v7/v8 CG 整图等比容纳：2752×1536缩为2560×1429，上5下6像素暖米色边，成品2560×1440（v8 的上下补边改为镜像边缘；`codex_greedy` 去掉模型自绘边框后两侧各修 32 像素背景）；无裁脸耳手、不拉伸。背景和封面保留此前成品，不重新加工。
- WebP参数 `quality=93`、`method=6`，立绘额外 `exact=True`。十八项实际字节和摘要见最新 `outputs/visual-v8-qa.json`（合计 11,236,188 字节），不沿用历史总字节数。
- v7累计24次生图、3次抠图，服务原图保留 `outputs/art-v7-source/`。v8 记录 25 次生图任务（1 次被服务拒绝后改写措辞重试成功，无鉴权错误），服务原图保留 `outputs/art-v8-source/`，联系表 `outputs/art-v8-cg-overview.jpg` 仅供查看。
- `outputs/visual-v8-qa.json` 记录十八项现行图像的尺寸、摘要、Alpha阈值比例及严格Alpha=0/255数量；`outputs/visual-v7-qa.json`、`outputs/visual-assets-qa.json` 和 `outputs/visual-v6-qa.json` 只用于旧批次追溯。
- 首轮浏览器对四张图实际绘入 canvas 检查透明及实体像素、四角透明度；十二 CG 均完整解码且满足高清 16:9。
- 已修正 Claude 深补的夜景与触手衔接，以及 Claude 贪心和客厅的非预期色带。

## 3. 从源码试玩与离线入口

要求 Node.js >=20。项目根目录运行 `npm run dev`，通过 `http://127.0.0.1:4173/` 打开源码入口。服务仅监听本机；换端口使用 `node scripts/serve.mjs --port 4174`。

最终单文件入口为 **`outputs/token-afterhours.html`**，与 **`dist/index.html`** 逐字节一致。直接用现代浏览器打开，不要求带上素材目录或联网。旧单文件不会随源码改动自动更新。

游戏及 Node 构建/测试脚本使用内置模块；浏览器验收另使用已有的 `playwright-core` 与兼容浏览器，可设置 `PLAYWRIGHT_MODULE`、`BROWSER_CHANNEL`。游戏运行不加载这些工具，也不调用生成服务。

## 4. 存档兼容边界

- 引擎 `four-nights-v4`；UI `token-four-nights-v4`。规则 v4 改变了数值，因此升级存档格式；自动档、三个手动档、每晚检查点与独立 CG 收藏都在新 namespace 下。
- v1、v2、v3 旧档不兼容、不迁移、不覆盖；CG 收藏为空时只读沿用 `token-four-nights-v3.collection`。兼容范围以合法动作和阅读阶段的重放验证为准。
- 导入导出仅当前局及阅读位置，不包括全部槽位与收藏；完整文件上限 128 KiB，按实际 UTF-8 字节检查。
- 坏档拒绝不改变当前局；新局、读档、刷新不清收藏。只有正常补给图载入并实际可见才解锁，缺图代示或饥饿分支不补收藏。
- `file://`、本地 HTTP、不同路径和浏览器不保证共享存储。更换试玩入口前，请先导出当前局。纯看画面标记不写入存档。

## 5. 复验顺序与证据

冻结所有源码、美术和文档后执行：

```sh
npm test
npm run build
npm run verify
npm run test:e2e
npm run package
```

`npm run check` 只含前三项，不包括浏览器、截图审看和源码包复验。构建之后若再改许可或设计文档，必须重新构建，不能套用旧摘要。

首轮已覆盖六结局实际按钮路线、贪心冷却/恢复、三次浅尝失败预警、危险选择取消、存读档、篡改拒绝、收藏、禁用存储降级与纯看画面。浏览器处于断网 `file:` 隔离上下文，外部请求及控制台错误均为零。320/390px、100%/200% 字号下测试了封面、选人、来访、回应、档位和最长补给对白。控件设计目标为48×48，现有自动化验收下限为44×44 CSS像素，不将两者混为实测结果。

| 证据 | 记录内容 |
| --- | --- |
| `outputs/visual-v8-qa.json` | 十八项现行资产完整解码、尺寸、Alpha、摘要，十一张 v8 CG 的选用版本、尝试次数与审看要点 |
| `outputs/visual-v7-qa.json`、`outputs/visual-v7-progress.json` | visual-v7 批次与当时测试进度，仅作追溯 |
| `outputs/visual-v6-qa.json`、`outputs/visual-assets-qa.json` | 旧生成批次追溯，不替代现行资产证据 |
| `outputs/asset-manifest.json` | 构建版本、图像字节/摘要、游戏与设计档案快照 |
| `outputs/verification.json` | 最终构建的静态结果 |
| `outputs/browser-qa.json` | 断网交互、响应式、像素检查、截图及被测文件摘要 |
| `outputs/release-qa.json`、`outputs/qa-summary.html` | 2026-09-26 快照的独立复验与摘要，未随本次重跑，仅作追溯 |
| `outputs/token-afterhours-source.zip` | 白名单源码与显式附带的已验证离线游戏 |

源码包仅收集 `src/`、`scripts/`、`tests/`、`docs/`、`.github/` 与指定根文件；不递归纳入 outputs/dist。独立复验需检查 CRC、路径、重复条目、有限隐私特征，并在全新项目内目录解压、测试、重建、对比成品。缓存、原始服务响应、签名 URL、凭据、用户存档与外部技能不得入包。

## 6. 未覆盖范围和授权

- 当前桌面与手机证据为 Chromium 自动化及截图审看，不等于实体手机、Safari、Firefox或完整读屏器测试；200% 为实际计算字号模拟。
- 没有真人计时或所有选择组合穷举。约15分钟只是设计目标；自动推进耗时不能当真人游玩时间。
- 静态插画演出，没有 Live2D、配音或新增音频；不宣称未实现功能已验收。
- 技术验收与授权审查分开。代码依 `LICENSE`；剧情、图像与品牌依 `ASSET-LICENSE.md`。参考中国台湾画师竹本嵐的抽象视觉特征，不代表授权、合作、认可或原作复制。
- 生成服务条款、输出近似性、标识、商标、再分发及商业使用仍需独立审查。生成成功、抠图或测试通过不保证排他版权和商业权利。
- 当前无 Git 仓库；本次不初始化、不提交、不推送、不部署、不上传，不生成公开分享链接。
