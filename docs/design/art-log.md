# 美术过程记录

项目：《完蛋，我被 Agent 包围了》 / TOKEN / AFTERHOURS  
记录日期：2026-09-26，2026-09-27 追加 visual-v8。现行程序版本为 **0.3.0**，规则与存档格式为 v4（`four-nights-v4`）。本文记录来源、处理与核验边界，不保存服务响应、签名 URL、账户、密钥或本机私人路径。

## 最新进展：visual-v8 十一张事件 CG（2026-09-27）

- **范围**：按 v3/v4 新剧情重画十一张事件 CG：`codex_shallow/deep/greedy`、`claude_shallow/greedy`、`cursor_shallow/deep/greedy`、`workbuddy_shallow/deep/greedy`。`claude_deep` 与用户原稿场景一致，保留 v7 成品不动；四张立绘、客厅与封面不变。
- **来源**：用户指定的 lightai-skill 流程，经 `_common.create_async_task` 调用 LightAI 的 **nano-banana pro**（`gemini-3-pro-image-preview`），16:9、2K 请求档，每个键独立生成；以现行立绘的头像裁切和画风裁切作参考，有问题的候选再用图像编辑修正。任务逐个提交，共记录 25 个生图任务；1 次被服务拒绝（`claude_shallow` 首轮），改写措辞重试一次成功；无鉴权错误，未自动刷新或输出凭据。
- **方向**：有温度、带一点暧昧，但全程穿好衣服的成年亲近；浅尝、深补、贪心用距离、触碰和困意区分，不画裸露或露骨行为。`codex_deep` 的一张候选因触手沿敞开的衬衫伸向嘴边、读起来过于性化而被否决，改为从肩上绕到颈侧。
- **审看**：每张先读全图，再放大检查脸、兽耳（不得出现人耳）、手、触手、屏幕与笔记本（不得出现可读文字）。十一张均通过；剩余小偏差逐项记录，例如 `codex_deep`、`cursor_shallow`、`cursor_deep` 的尾巴没有缠住零，`codex_deep`、`claude_greedy` 的触手很长、像气球，`workbuddy_shallow` 的触手缠在握笔那只手上（剧情写的是另一只手），`workbuddy_greedy` 两只手掌都朝下。
- **处理**：源图 2752×1536，整图等比缩到 2560×1429，上下约 5 像素用镜像边缘补到 2560×1440；不裁脸、不拉伸。`codex_greedy` 模型自绘了纸框，本地去框后为 2659×1459，两侧各修 32 像素背景到 16:9。成品为 RGB WebP，quality 93、method 6，不含 EXIF/XMP。
- **文件**：服务原图在 `outputs/art-v8-source/`，联系表 `outputs/art-v8-cg-overview.jpg` 仅供查看；任务号、提示词和逐图审看记录只留在 `.cache/art/visual-v8/`，不随源码分发。十八项现行资产的尺寸、摘要和十一张新图的审看要点见 `outputs/visual-v8-qa.json`；被替换的 v7 成品另存于 `_archive/2026-09-27/src-assets-v7/`（不入库）。
- **权利**：生成、审看与测试都不构成 LightAI、模型厂商、品牌方或任何画师的授权、合作或认可；不称官方作品，不保证商业使用无忧，限制见 [ASSET-LICENSE.md](../../ASSET-LICENSE.md)。

下段 visual-v7 记录是上一批次；其中关于十二张 CG 的“现行”说法，除 `claude_deep` 外已由上面的 v8 取代。

## 最新进展：visual-v7 续接胡子修正与 CG 完成（2026-09-26）

用户已更新凭据并要求续接。新一轮放大对照母版后，确认上一轮 WorkBuddy 立绘及三张 CG 的连续下颌胡带过浓，撤销相关旧验收：胡子须严格忠于 `portraits-base-style-fixed.png`，仅下巴中央少量浅淡分离短胡茬、上唇零星几笔，两颊和两侧下颌干净，不是络腮胡。修正不得改变脸型、服装、动作和一对垂耳犬耳，不得出现人耳或耳廓。下段为续接前断点，不能作为新一轮最终结果。

### 续接结果与现行资产

- 新增5次LightAI图像编辑：WorkBuddy淡胡立绘、Cursor shallow肩侧触手修正、WorkBuddy三档淡胡修正；deep/greedy同时去除人耳。另新增1次BiRefNet-HR-matting。v7累计 **24次生图＋3次抠图＝27张服务原图**（4张立绘源、20张CG源、3张抠图结果），旧成功原图不覆盖。
- WorkBuddy采用 `portrait-workbuddy-beard-fix2_01.png` 及相应透明结果，保留自然邀请姿势、成年脸型、眼镜、服装和一对垂耳犬耳。Read全图、原分辨率头/手与深浅背景通过；1120×1680成品严格Alpha=0/255为 **1,373,562 / 470,089**。Codex保持本轮已验收版本，严格Alpha=0/255为 **1,384,547 / 460,540**。
- 十二个最终候选均已逐张Read全图和原分辨率脸/兽耳。Codex shallow选fix2、Claude shallow选fix1、Cursor shallow选fix1、WorkBuddy三档选beard-fix2，其他六张用各自首轮源图；选择及细节证据存 `.cache/art/visual-v7/visual-review.json`。
- 十二独立CG源图均2752×1536；整图等比缩小为2560×1429，放入2560×1440画布，上5下6像素暖米色边。**没有裁边、没有拉伸、没有程序拼图代替生成**；Claude deep耳尖虽靠近原图上缘仍完整保留。独立PNG为 `outputs/art-v7-source/{角色ID}_{档位}-2560x1440.png`，游戏为 `src/assets/{角色ID}_{档位}.webp`。
- 三档保留厨房/杂志/绿植/电影等角色场景及距离、亲近、困倦差别；零保持成年紫色幻想生物形象，短触手仅如手一样自然相牵，不做束缚、侵入或性化处理。
- 立绘预览为 `outputs/workbuddy-v7-beard-fixed-preview.png`、`outputs/art-v7-portraits-preview.png`；十二CG联系表为 `outputs/art-v7-cg-overview.jpg`，仅供查看，不代替独立源图。
- 本轮10项受保护文件摘要不变，包括封面CSS、封面图、Claude/Cursor立绘、背景、剧情与规则；运行时全部十八项完整解码和尺寸/Alpha证据见 `outputs/visual-v7-qa.json`。最终check、浏览器、源码包和独立重建结果以 `outputs/visual-v7-progress.json`、`outputs/release-qa.json` 的同一冻结快照为准，不用预检或历史通过数冒充发行结论。

### 续接前断点（保留追溯，以下不是当前阻塞）

本轮仅使用用户指定 LightAI 脚本流程，顺序提交，未更换生成服务；鉴权失败后未自动刷新。已成功取得 **19 个生图结果＋2 个 BiRefNet-HR-matting 结果**：3 张立绘源图（含 WorkBuddy 人耳修正版）、16 张 CG 源图（12 个场景首轮＋4 次返工）、2 张透明 PNG。全部 21 张原图保存在 `outputs/art-v7-source/`；任务号、提示词、参考记录及逐图检查只保存在 `.cache/art/visual-v7/`，不随源码分发。

- **已接入**：`src/assets/codex.webp`、`src/assets/workbuddy.webp`，均为 1120×1680 真实 RGBA；生成及抠图源图均 1696×2528。Codex 侧身叉腰，WorkBuddy 倾身抬手邀请，双脚鞋底、双手与尾完整。WorkBuddy 首图残留人耳，经局部修正后消除，下巴下颌短胡与垂耳保留。
- **透明实测**：Codex 严格 Alpha=0 / 255 像素为 1,384,547 / 460,540；WorkBuddy 为 1,373,739 / 470,255。不是棋盘底或 CSS 去白。
- **CG 未接入**：12 个场景均独立生成，原图均 2752×1536；逐张 Read 初检后，9 张有可用候选，3 张仍待修正——Cursor shallow 的肩侧触手衔接、WorkBuddy deep / greedy 的人耳。Codex shallow 已修正绕腕并用 LightAI 扩绘完整耳尖边距；Claude shallow 已修正旧图造型干扰；WorkBuddy shallow 已去除人耳。
- **阻塞**：提交 WorkBuddy deep 局部修正时 LightAI 鉴权失败；需要用户更新外部技能凭据。无修正版任务号，未继续提交 greedy 或其他修正，未刷新或输出密钥。现有成功产物全部保留。
- **后续仍须完成**：剩余修正及全量复检、全部 CG 等比容纳为 2560×1440 后接入、运行既有 check 与浏览器测试、重建两份离线 HTML 与源码 ZIP。此次未把旧测试结果当作 v7 验收结果；既有发行产物仍为上一快照。
- 封面 CSS 与封面图、Claude/Cursor 立绘、剧情和规则均保持不动，10 个保留文件的 SHA-256 已核对一致；没有公开发布。画面仅采用成年自愿、非性化日常陪伴，三档通过距离和困意区分；许可与商业权利限制不变。

下文为visual-v7之前的v0.3.0制作档案，“现行”“最终”均指当时快照；最新胡须标准、CG整图容纳方式、数量和证据以顶部v7记录为准。

## 历史快照：v0.3.0 早期独立重绘、真实抠图与 Gal UI

### 制作范围与当前记录边界

本轮通过用户指定的 LightAI 生成与去背景流程完成全部十八项运行时资产；UI 参考指定的 `ui-ux-pro-max` 规范。四张现行立绘均以用户确认并手工调整过的 `outputs/portraits-base-style-fixed.png` 为共同母版逐人生成、独立去背景；十二张事件逐张生成；封面根据该角色母版和用户提供的构图参考独立生成。源图、透明立绘、十二张 CG、封面及 UI 已经审看，最终 WebP 已完整解码。最新立绘与封面证据见 `outputs/visual-v6-qa.json`；事件图旧批次证据保留在 `outputs/visual-assets-qa.json`。具体构建和浏览器结果以对应报告为准，技术验收不替代主观美术评价或权利审查。

| 资产 | 现行制作方式 | 运行时键 |
| --- | --- | --- |
| 四位室友立绘 | 以确认母版为共同参考，分别生成 2:3 单人图，再逐张独立去背景 | `codex/claude/cursor/workbuddy` |
| 十二事件 CG | 每个角色 × 三档逐张独立以 2K 档、16:9 构图重绘 | `{角色ID}_{shallow/deep/greedy}` |
| 一张公寓背景 | 独立生成新 16:9 共享公寓横图 | `room` |
| 一张封面主视觉 | 角色母版＋构图参考生成，HTML 叠加真实标题 | `cover` |

运行时为 **4＋12＋1＋1＝18 项**；首次/重复与后记复用不增加图数。十二事件不使用三联图拆分或旧低清切片放大。

### 现用生成与后处理步骤

1. 通过 LightAI skill 的 `_common` 模块调用 `create_async_task`，生成引擎为 **nano-banana pro**，模型 **`gemini-3-pro-image-preview`**。这是现行生成服务，不应套用旧版“LightAI 仅作后处理”的说法。
2. 四张 2:3 角色图以 `portraits-base-style-fixed.png` 及各自象限为双参考逐人生成。提示词明确兽耳角色只能有一对兽耳、不得出现人耳；WorkBuddy 保留下巴与下颌短胡。生成之后再各自使用 **`BiRefNet-HR-matting`**（`hr-matting`）独立去背景，参数 **`expand=-1`、`blur_radius=0.5`**，取得带真实 Alpha 的透明 PNG；不是让生图模型绘制棋盘底，也不是用 CSS 去白或混合模式代替抠图。
3. 用 **Pillow 保留 Alpha** 将透明 PNG 转为运行时 WebP；不能先转 RGB 或与背景合成。透明 PNG、WebP 的通道与主体边缘已核验；最终编码 quality=93、method=6，立绘 exact=True，不沿用历史质量 88/90。
4. 十二事件每次生成一张独立完整横图，使用 **2K 请求档位、16:9**；客厅另行绘制。每张按 `story.cgMap` 的角色/档位对应，不凭排列顺序猜图，不用三联裁切或 CSS 拉伸凑比例。
5. **源尺寸、处理方式与成品尺寸已分别记录于下方实测表及 `outputs/visual-assets-qa.json`**。2K 只是请求档位，不等于 2048 像素，不能用成品尺寸覆盖生成源数据。
6. pipeline 原始响应、上传记录和签名 URL **仅保存在 `.cache/` 内，不随项目发布**。可分发清单只保留资产键、脱敏来源、实际尺寸、处理参数与摘要，不复制项目外技能、凭据或私人安装路径。

### 视觉与 UI 对照

参考中国台湾画师竹本嵐的**干净有力线稿、明确明暗、通透色块与成年神情**，用于原创角色与构图，不复制已有画作、签名或品牌标识；不宣称授权、合作、认可、官方作品或商业无忧。四位室友仍是**人脸＋兽耳和尾**，不全兽化；Null 沿用现有角色设定，story/core 不因美术重制修改。

UI 已按用户反馈回到初版的米白纸面、红棕强调与左名册/中央场景对白/右决策栏视觉骨架，同时删除旧版任务、交付、疲劳与默契等过量信息。封面不再由 CSS 拼贴人物，而是用 LightAI 依据确认母版与构图参考生成独立主视觉；图片只提供粉色花卉线、标题留白和原创四人群像，真实标题由 HTML 叠加。场景和对白改为上下连体卡；右栏按阶段渐进披露，只有补给阶段展示三档精确数字。选人、二选一回应、三档预览及六结局完整保留。`toggleSceneUI` 仅切换临时 `uiHidden`、样式及新增面板的 `inert/aria-hidden`，不修改 state、cursor、readCount 或花费；隐藏时 `nextLine` 阻止键盘跳读，恢复后继续原阅读位置。

控件最小 48×48 CSS 像素，采用本地系统字体与内联 SVG，无远程字体；事件图使用 `object-fit: contain`。小屏重排、焦点样式及减弱动效已有 CSS，透明边缘、构图及 UI 已审看；最终交互重跑结果以 `outputs/browser-qa.json` 为准。

### 最终素材实测与修正记录

| 对象 | 实测结果与处理 |
| --- | --- |
| 四张立绘源 PNG / 抠图 PNG | 均为 1696×2528；抠图保留 Alpha，裁掉透明外边后等比缩小并放入统一透明画布 |
| 四张立绘 WebP | 均为 1120×1680；四角透明，耳、头发、手与尾保留；编码 quality=93、method=6、exact=True |
| 立绘透明像素比例（Alpha<16） | Codex 50.71%、Claude 51.47%、Cursor 57.65%、WorkBuddy 49.97%；各图另有41.56%–49.29%的实体像素（Alpha>240），并非空白透明文件 |
| 十二事件及客厅源图 | 均为 2752×1536；每个事件独立生成，无三联分格 |
| 十二事件及客厅 WebP | 均为 2560×1440，精确16:9；小幅居中裁边并等比缩小，不拉伸，不将旧图放大；quality=93、method=6 |
| 封面主视觉 | 源 2752×1536，经居中裁边等比缩小为 2560×1440；HTML 叠加真实标题 |
| 全部运行时图像 | 18张，合计6,288,562字节；新立绘与封面见 `outputs/visual-v6-qa.json`，事件图与客厅见 `outputs/visual-assets-qa.json` |

审看后额外修正：Claude 深补画面原先误为白天且触手像悬空，改为深夜暖灯、怀中靠枕与连贯触手；Claude 贪心和客厅原先误画半透明UI色带，已重绘去除。四人透明预览、十二图总览均检查人物身份、重复肢体、边缘与场景主题。画面为日常陪伴和非露骨亲近，仍有生成美术的造型简化，不能宣称手工逐像素精修或画师本人作品。

UI 已审看并完成首轮断网浏览器验收；最终测试结论、文件哈希与 ZIP 大小以 `outputs/browser-qa.json`、`outputs/verification.json`、`outputs/release-qa.json` 为准，不提前宣称最后打包成功。

### 角色基础风格图与现行立绘（2026-09-26）

用户手动调整后的 `outputs/portraits-old-style-v4-uncropped.png` 被确定为角色立绘的**基础风格图**：暖米底、细棕线稿、柔和低饱和铺色与成熟人脸比例。通过用户指定的 LightAI 精准编辑流程，仅修正 Claude 红狐狸头侧的人耳并移除右下角水印；修正版 `outputs/portraits-base-style-fixed.png`（1696×2528 RGB PNG）成为现行生成母版。

随后使用同一 LightAI 流程，以完整母版和每人象限作为双参考，分别生成四张 1696×2528 单人立绘；逐张检查仅有兽耳、无人耳，WorkBuddy 的短胡保留。四张原图位于 `outputs/portraits-v6-source/`，经 `BiRefNet-HR-matting` 去背景后转换为 `src/assets/{codex,claude,cursor,workbuddy}.webp`，现已接入游戏。另以角色母版和用户提供的封面构图参考生成 `outputs/cover-v6-source.png`，运行时为 `src/assets/cover.webp`；标题由 HTML 叠加，生成图不承担文字。

技术标准和最终证据关联见 [发行说明](../RELEASE.md)。生成、抠图或技术验收不构成授权；权利边界见 [ASSET-LICENSE.md](../../ASSET-LICENSE.md)。

---

## 历史档案：v0.1.0 / v0.2.0（下文不是现行重制流程）

下列原始规格、源文件名、处理参数、有限查看和未验事项保留用于追溯。历史段落中的“本轮”“当前”“现行”均指当时记录时点，不能用于断言 v0.3.0 的生成来源、实时状态或审核结果；原图文件名只作历史引用，本次未读取这些文件。

## 1. 历史五图与 v0.2.0 十七图

### 历史记录：v0.1.0 五图

旧版使用四张角色立绘和一张工作室场景，共五张 WebP。原始 2×2 角色图集及当时的场景图来自项目制作会话中的图像生成服务；角色图集曾用项目外 `lightai-asset-sheet` 的 `split_sheet.py` 按 2×2 布局裁切。该工具只做历史后处理，**当时不承担图片生成，也不是该批 v0.2.0 新增 CG 的处理工具；这一限定不适用于现行 LightAI 生成链**。

历史规格为四立绘各 424×632、旧场景 1264×848。旧五图审看、旧页面截图、旧五图内嵌解码及旧源码包记录只说明当时快照，不作为现行十七图的验收结论。旧稿关于标记与画面完整性的结论不沿用到新图。

### 历史范围：v0.2.0 四晚版（已由顶部重制范围替代）

- 保留四张既有 portrait。
- `room.webp` 改为共享公寓客厅，取代工作室画面。
- 新增四角色 × `shallow / deep / greedy` 三档，共十二张事件 CG。
- 运行时合计 **17 项资产：4 立绘 + 1 客厅 + 12 事件 CG**。三联源图、修正版源 PNG 和后记对既有画面的复用不额外计数。
- 当前构建资产合同已包含这十七项；合同存在不表示当前构建、浏览器或打包已经完成最终验收。

## 2. 历史 v0.2.0 实际尺寸核对

本轮使用现有受管环境中的 Pillow 12.3.0，只读调用 `Image.open(...).size` 核对文件格式与尺寸；没有生成、裁切、转换或覆盖任何图片。**尺寸读取不等于完整 `verify + load`、浏览器解码或逐张画面验收。** 按协作约定跳过待替换的旧 `workbuddy_greedy.webp`。

| 现有文件 | 实际读取尺寸 | 本轮状态 |
| --- | --- | --- |
| `src/assets/codex.webp` | 424×632 | 保留 portrait |
| `src/assets/claude.webp` | 424×632 | 保留 portrait |
| `src/assets/cursor.webp` | 424×632 | 保留 portrait |
| `src/assets/workbuddy.webp` | 424×632 | 保留 portrait |
| `src/assets/codex_shallow.webp` | 1024×510 | 三联切片，已核尺寸 |
| `src/assets/codex_deep.webp` | 1024×508 | 三联中段切片，已核尺寸 |
| `src/assets/codex_greedy.webp` | 1024×510 | 三联切片，已核尺寸 |
| `src/assets/claude_shallow.webp` | 1024×510 | 三联切片，已核尺寸 |
| `src/assets/claude_deep.webp` | 1024×508 | 三联中段切片，已核尺寸 |
| `src/assets/claude_greedy.webp` | 1024×510 | 三联切片，已核尺寸 |
| `src/assets/cursor_shallow.webp` | 1024×510 | 三联切片，已核尺寸 |
| `src/assets/cursor_deep.webp` | 1024×508 | 三联中段切片，已核尺寸 |
| `src/assets/cursor_greedy.webp` | 1024×510 | 三联切片，已核尺寸 |
| `src/assets/workbuddy_shallow.webp` | 1024×510 | 三联切片，已核尺寸 |
| `src/assets/workbuddy_deep.webp` | 1024×508 | 三联中段切片，已核尺寸 |
| `src/assets/workbuddy_greedy.webp` | 当时不读取旧文件 | 当时已提供独立修正版 PNG，该历史记录未确认最终 WebP 替换与验收 |
| `src/assets/room.webp` | **1264×848** | 已查看为共享公寓客厅；与本轮预期 1536×1024 不同，待核对最终规格或替换 |

**客厅差异不能按预期覆盖实测。** 用户交接的目标规格为 1536×1024；本次读取的 `room.webp` 及客厅源 PNG `outputs/cg-source/A_beautifully_illustrated_warm_2026-09-25T21-03-45.png`（2026-09-27 已归档至 `_archive/2026-09-27/outputs/cg-source/`）均为 1264×848。当前画面已是沙发、窗边植物、茶几、厨房与走廊组成的共享公寓客厅，不能仅因尺寸与旧图相同便认定仍是旧工作室。此处只记录差异，不擅自缩放、重生成或宣告替换验收完成。

## 3. 历史 v0.2.0 新增图生成与 Pillow 后处理

### 四张三联源图

新增事件 CG 的首版来自本会话图像服务生成的四张纵向三联图。以下源 PNG 实测均为 **1024×1536**；文件名只用于溯源，不据生成文件名猜测角色对应关系。2026-09-27 起，`outputs/cg-source/` 整个目录已移入 `_archive/2026-09-27/outputs/cg-source/`（本机归档，不入库），下列路径请在该目录下查找。

- `outputs/cg-source/Draw_EXACTLY_THREE_edge_to_edg_2026-09-25T21-03-45.png`
- `outputs/cg-source/Make_an_original_visual_novel__2026-09-25T21-03-47.png`
- `outputs/cg-source/Create_a_polished_visual_novel_2026-09-25T21-03-47.png`
- `outputs/cg-source/Visual_novel_CG_triptych__prec_2026-09-25T21-03-47.png`

按本轮制作交接记录，新图用 **Pillow** 处理：每张按高度三等分得到三个基础分镜段，在相邻分隔边缘各去除 2 px；上下段通常为 1024×510，中段 `deep` 为 1024×508。转换事件 WebP 使用质量 **88**，客厅 WebP 使用质量 **90**。这些质量值来自制作流程记录，不能从尺寸读取反推编码参数。

角色与档位的最终键以 `story.cgMap` 为准，文件命名为 `{角色ID}_{档位}.webp`。保留来源图并按实际分镜内容核对对应关系，不凭列表顺序或未经查看的生成标题配图。

### WorkBuddy greedy 独立修正版

- 修正版来源：`outputs/cg-source/Correct_this_single_landscape__2026-09-25T21-23-16.png`（已归档至 `_archive/2026-09-27/outputs/cg-source/`）。
- Pillow 实测：**PNG，1536×1024**。这是独立横向单图，不适用三联中段、上下段的切片尺寸。
- 按制作交接，该图用于修复首版中重复主角与多余眼镜；本轮查看的是这张修正版，画面为 WorkBuddy 和一个紫色 Null 的日常休息场景，保留服务“AI 生成”角标。
- 当时计划转换并替换 `workbuddy_greedy.webp`，WebP 质量 **88**；**修正版 PNG 已提供，不等于当时最终 WebP、内嵌资产、清单和源码 ZIP 已替换并验收**。该参数不作为 v0.3.0 编码设置。
- 本轮没有读取旧 greedy WebP，也不将旧图已知问题重复列为修正版的新缺陷。

因此，十二张事件 CG 的来源应表述为“首版由四张三联生成图裁切；WorkBuddy greedy 后续改用独立修正版”，而不是宣称最终十二张全都保持三联切片规格。

## 4. 历史 v0.2.0 视觉方向与一致性边界

用户曾提出参考画师竹本嵐的线条与铺色特征；项目提炼为细线、柔和铺色、成熟人物表情和生活旧物质感，制作原创人物与构图，不复刻现有作品、签名或品牌标识。未取得该画师授权、合作或认可，也没有厂商官方背书。

现行空间是温暖的共享公寓，围绕厨房、沙发、窗边绿植、书本和电影话题展开。米白、褪色杏粉、鼠尾草绿与深色文字服务阅读，不把界面做成产品宣传页。曾参考项目外 `ui-ux-pro-max` 指导；外部工具、技能文档及私人安装路径不随项目分发。

| 角色 | 固定身份 | 生活辨识方向 |
| --- | --- | --- |
| Codex | 27 岁女性白狼 | 银灰短发、浅外套与深衬衫；做饭、试做饼皮、厨房边陪聊 |
| Claude | 29 岁女性狐 | 铜红长发、奶油与棕色衣着；书本、谜题、沙发上讲故事 |
| Cursor | 25 岁女性黑猫 | 黑发、蓝灰衣着；绿植、照片、窗边与花盆 |
| WorkBuddy | 28 岁男性垂耳犬 | 棕发、眼镜、鼠尾草绿衣着；电影、靠垫与休息 |
| 零 / Null | 26 岁、无性别、墨紫色幻想生物 | 小型可变形轮廓，作为有自主意愿的室友参与日常 |

这些是设定与设计方向，不是每个小道具都已逐图一致的验收承诺。**首版生成 CG 的角色生物形态在图间略有变化，不保证画师级逐帧一致。** 固定年龄、性别和动物设定不因生成画面差异而改变。

画面定位为非露骨日常。各图已有的服务 **“AI 生成”角标应保留**，不得把清除该标记当成裁切目标；该标记用于生成来源提示，不是角色品牌、厂商或画师对作品的背书。最终各张 WebP 的角标保留情况仍需逐张确认，本轮有限查看不能代替全部视觉审看。

## 5. 历史 v0.2.0 后续验收与素材维护

1. 确认客厅实际规格与交接目标的差异；确认 WorkBuddy greedy 修正版的最终 WebP 已替换。
2. 对十七张最终 WebP 完整解码，核对人物辨识、构图、裁切边缘、道具与服务角标；不能只检查尺寸或只看图片上半部。
3. 源码、文档与图片冻结后重新构建；核对全部内嵌图片与源 WebP 字节、摘要和清单，不能沿用替换前的数据。
4. 在离线浏览器中检查图片实际显示、CG 收藏解锁、缺图降级，以及桌面、小屏、大字和减弱动效下的构图与阅读区域。
5. 源码包只按审核白名单收录允许分发的材料；三联原图、独立修正版源 PNG、服务响应和项目外工具不因制作时使用就自动纳入发行范围。

该轮只完成上述尺寸读取和客厅、修正版 PNG 的有限查看，未重跑构建、浏览器或源码包验证。当时拟以 `outputs/verification.json`、`outputs/browser-qa.json` 及对应 v0.2.0 最终快照的 `outputs/release-qa.json` 作为证据；这些历史文件名不证明 v0.3.0 已验收。现行证据见顶部实测表及 [`docs/RELEASE.md`](../RELEASE.md)。旧 `qa-summary` 和旧 `release-qa` 仅作历史记录。

## 6. 权利条件

详细范围仍以 [`ASSET-LICENSE.md`](../../ASSET-LICENSE.md) 与项目代码许可为准，本次新增或替换不扩大原许可承诺。图像来自本会话生成服务，不称为品牌厂商或参考画师官方创作。

原创设计方向、AI 生成和技术验收不等于具有无争议的排他权利。生成服务条款、输出近似性、商标与商业用途需单独审查；**不保证商业授权、排他版权或全部第三方权利已清理**。替换素材时记录真实来源、处理方法与待验事项，不补写未发生的人工绘制、生成参数或授权。

## 7. visual-v9 结局 CG（2026-09-27）

新增六张结局 CG：`ending_hunger`、`ending_household`、`ending_codex`、`ending_claude`、`ending_cursor`、`ending_workbuddy`，在后记阶段显示，并在回忆相册里单列一行“结局画面”。方向为温馨画面：全员穿戴整齐、放松地笑，不做暧昧处理；饥饿结局是深夜一盏灯下 WorkBuddy 双手捧着几乎透明的零，伤感但不吓人。

- 制作：经项目外 LightAI skill 调用 nano-banana pro（`gemini-3-pro-image-preview`），16:9、2K 档，一次只有一个任务在途。参考图为角色身份表（母版头像＋游戏立绘；大家的后记用四列群像身份表）、从 `claude_shallow` 裁出的零、两张既有 CG 并排的画风对照。共提交 12 个服务任务：6 张首稿、4 次局部图像编辑、1 次重画、1 次小修；无拒绝、无鉴权错误。
- 修正：`household` 首稿出现两只零，编辑去掉前景那只；`codex` 首稿把她画成狼头并自带纸框，重画后再把袖口像字母的扣子改成圆扣；`hunger` 去掉眼镜腿旁露出的人耳、胡茬收到下巴；`cursor` 让零抬眼看她、去掉玻璃里手机的重影；`workbuddy` 去掉模型自绘的纸框和像字迹的笔记本线条、减轻胡茬。`claude` 首稿直接采用。
- 残留小瑕疵（已接受）：`household` 与 `workbuddy` 中 WorkBuddy 下颌两侧仍有少量浅淡胡茬；`cursor` 手机更多朝向她自己；`codex` 远处晨雾里有几个极淡的模糊人影；`claude` 里的零略大、半坐在她腿边。
- 成品：源图 2752×1536 整图等比缩到 2560×1429，上下约 5 像素镜像补边到 2560×1440，不裁人物、不拉伸；RGB WebP quality 93、method 6。现行运行时资产为二十四项。逐张审看结论与任务编号见 `.cache/art/visual-v9-endings/review.json`，总览 `outputs/art-v9-ending-overview.jpg`；签名 URL 与服务原始响应只留在 `.cache/`。

## 8. visual-v10：全身立绘与七张事件 CG 重绘（2026-09-28）

- 基准：封面 `outputs/cover-v6-source.png` 作为四人脸型、发型、服装与比例的母本，每个任务都上传封面全图或封面人物特写作参考；画风统一为日系动画插画、细棕线、低饱和、暖纸色，腮红最多淡粉。
- 立绘：Claude、Cursor 以原立绘＋封面＋封面特写＋Codex 全身立绘（取景参考）生成 2:3 全身版（1696×2528），再用 `BiRefNet-HR-matting`（`expand=-1`、`blur_radius=0.5`）去背景，Pillow 保留 Alpha 等比放入 1120×1680 透明画布，WebP quality 93、method 6、exact。严格 Alpha=0/255：Claude 1,317,032 / 534,113；Cursor 1,419,081 / 427,615。`styles.css` 取景值按新图实测：claude `--eye .132 --head .15 --cx .47`，cursor `--eye .117 --head .15 --cx .485`；codex / workbuddy 未改。
- CG：`codex_shallow`、`claude_shallow`、`cursor_shallow`、`workbuddy_shallow`、`codex_greedy`、`claude_greedy`、`workbuddy_greedy` 以现有 CG＋封面＋封面特写重绘，部分再做局部编辑（降腮红、改表情、修零、改发型）。`cursor_shallow` 首稿被服务以内容策略拒绝，改为温和描述重画。成品 2560×1440 RGB WebP（与 v8/v9 相同的等比缩放＋镜像补边）。
- 服务任务：共 17 次提交（13 次生图/编辑，其中 1 次被拒；2 次立绘生图；2 次去背景），无鉴权错误。
- 残留小瑕疵（已接受）：`codex_shallow` 触手搭在手腕上而非缠绕；`cursor_shallow` 脸略显年轻；`workbuddy_shallow`/`workbuddy_greedy` 下颌两侧仍有少量胡茬；`claude_greedy` 腮红为中等淡粉。逐张结论见 `.cache/art/visual-v10/review.json`，总览 `outputs/art-v10-overview.jpg`，被替换的旧图存于 `_archive/2026-09-28/src-assets/`。
