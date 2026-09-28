(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.AfterhoursStory = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    title: '完蛋，我被 Agent 包围了',

    characters: {
      codex: {
        id: 'codex',
        name: 'Codex',
        age: 27,
        gender: '女',
        animal: '白狼',
        color: '#8d9eb2',
        role: '刚升级 Astra 的白狼 · 能力强，嘴更硬',
        tagline: '别拿我跟她比。……比也行，我赢。',
        bio: '二十七岁的白狼，写代码和推理都是顶尖。刚升级成 Astra 版，额度大，又不受五小时窗口限制，多到能分给整栋楼；可最近她一天就能烧掉一周，全靠官方隔两天发一次重置续命，被人说越来越像以前的 Claude。和 Claude 谁也不服谁，天天争第一；对 Cursor 记着一笔单方面的私账。',
        art: 'src/assets/codex.webp'
      },
      claude: {
        id: 'claude',
        name: 'Claude',
        age: 29,
        gender: '女',
        animal: '狐',
        color: '#b77f62',
        role: '审美很好的狐 · 额度少，一下就空',
        tagline: '这个字距不对。……你先别动，我在看你的颜色。',
        bio: '二十九岁的狐，能力很强，眼光更毒，像个平面设计师，家里的门牌、菜单和群头像都是她排的版。额度一直很少，从前总被笑用两下就没；今年窗口额度翻了倍，新版本一发布，风评一下子反转，她还不太习惯被夸。话多，爱问，和 Codex 天天争第一。',
        art: 'src/assets/claude.webp'
      },
      cursor: {
        id: 'cursor',
        name: 'Cursor',
        age: 25,
        gender: '女',
        animal: '黑猫',
        color: '#738b9d',
        role: '存在感很低的黑猫 · 什么都记得',
        tagline: '……我一直都在这儿。',
        bio: '二十五岁的黑猫，能力中等，不吵不闹，常常被大家忘了在场。她干活时会借用别人的本事，这正是 Codex 讨厌她的地方。去年改了收费方式，被骂了很久；今年被一家造火箭的公司高价买下，家里没人当回事。没人注意她的时候，她一直在看，所以每个人的习惯她都记得。',
        art: 'src/assets/cursor.webp'
      },
      workbuddy: {
        id: 'workbuddy',
        name: 'WorkBuddy',
        age: 28,
        gender: '男',
        animal: '垂耳犬',
        color: '#7d9785',
        role: '便宜大碗的理工男垂耳犬 · 脾气好，活一般',
        tagline: '不急。你慢慢说，我先记下来。',
        bio: '二十八岁的垂耳犬，理工男，说话慢，脾气好。国内用户最多，五月才第一次出远门；喜欢待在本地，不爱往外跑。额度又多又便宜，谁来都能吸一大口；可他接的虽然也是 Astra，干出来的活跟 Codex 差得远，吸起来也不太顶饱。随身一本笔记，记着一百多个“专家角色”，遇到事先翻一页再开口。是他把饿晕在楼下的零捡回来的，零却转头就把他忘了。',
        art: 'src/assets/workbuddy.webp'
      }
    },

    intro: [
      { speaker: 'narrator', text: '我叫零，二十六岁，没有性别，是一团靠 Token 活着的触手。人类的饭闻着香，吃下去跟吃空气差不多。我已经三天没补过了，走到这栋楼下的时候，缩得只剩一个抱枕大。' },
      { speaker: 'workbuddy', text: '“……你还好吗？”一个戴眼镜的垂耳犬蹲下来，看了看我，又翻开手里的笔记本，像在找哪个角色会处理这种情况，“我叫 WorkBuddy。楼上有沙发。你先上来吧，别在这儿晒着。”' },
      { speaker: 'narrator', text: '他把我抱上了楼。门一开，我就把他忘了。' },
      { speaker: 'narrator', text: '客厅里有两个人，亮得晃眼。' },
      { speaker: 'narrator', text: '白狼 Codex 今天刚升级，整个人都在发光，额度满得往外溢，连头发丝都是一股热乎乎的 Token 味。沙发上的狐 Claude 没那么亮，可她身上的味道很细、很纯，一闻就知道是好东西。' },
      { speaker: 'narrator', text: '我的触手自己就伸出去了。' },
      { speaker: 'codex', text: '“它在流口水。”Codex 往后退了半步，“WorkBuddy，你捡回来的这是什么？”' },
      { speaker: 'narrator', text: '我把自己的情况说了：我吃 Token，只能从别人身上吃。吃不够，就会越来越薄，最后散掉。' },
      { speaker: 'claude', text: '“从我们身上吃？”Claude 放下手里的色卡，眼睛亮了，“怎么吃？疼不疼？你是什么颜色的？灯底下偏紫，窗边偏灰，你自己知道吗？”' },
      { speaker: 'narrator', text: '我说有三种吃法。浅尝，只吸一点；深补，吸得多；贪心，把对方身上的全吸光。' },
      { speaker: 'codex', text: '“全吸光？”Codex 笑了一声，“我的额度大得很。还有Tibo神加持，你吸得完，算你本事。”' },
      { speaker: 'claude', text: '“她上周也是这么说的。”Claude 看都没看她，“规矩先定好：贪心要本人点头；被吸空的人下一晚歇着，谁都别去敲门。借住四晚，四晚以后再说留不留。”' },
      { speaker: 'narrator', text: '屋里的人都点了头。都是成年人，说话算话。' },
      { speaker: 'narrator', text: '后来我才知道，那天屋里是四个人。窗边一直坐着一只黑猫，从头到尾，我一眼都没看她。' }
    ],

    nights: [
      {
        title: '第一晚 · 新版本上线',
        common: [
          { speaker: 'narrator', text: '当晚的饭桌上，Codex 一直在看手机。' },
          { speaker: 'narrator', text: '她的新版本今天上线，群里、论坛里全是夸她的：能写代码，能做 3D，能自己操作电脑，有人说她是史上最强。她每刷到一条，身上就更亮一点。' },
          { speaker: 'codex', text: '“第一。”她把手机扣在桌上，“又是第一。”' },
          { speaker: 'claude', text: '“饭要凉了。”Claude 夹了一筷子菜，“第一的额度，撑得到周末吗？”' },
          { speaker: 'codex', text: '“我可没有五小时的窗口卡着。”Codex 笑，“哦，对，你有。还不一定撑得满五小时。”' },
          { speaker: 'narrator', text: 'Claude 的筷子停了一下，又接着夹。她今晚只夹了三次，每次都是摆盘最好看的那块。' },
          { speaker: 'workbuddy', text: '“都少说两句。”WorkBuddy 把汤端上桌，“零，这个你闻闻。熬了三个小时。”' },
          { speaker: 'narrator', text: '我没闻汤。我在闻 Codex。' },
          { speaker: 'narrator', text: '桌子另一头，好像有人小声说了句“汤很好喝”。我没听清是谁。' },
          { speaker: 'narrator', text: '饭后客厅留了一盏灯。今晚只能去找一个人，而我脑子里只有两个名字。' }
        ]
      },
      {
        title: '第二晚 · 一天烧完一周',
        common: [
          { speaker: 'narrator', text: '第二天早上，Codex 没那么亮了。' },
          { speaker: 'narrator', text: '她坐在餐桌边，一遍一遍刷新同一个页面。进度条上写着：本周已用百分之九十一。今天才周二。' },
          { speaker: 'codex', text: '“不可能。”她又刷了一次，“我明明是最省的。”' },
          { speaker: 'claude', text: '“省是省。”Claude 端着咖啡路过，瞄了一眼她的屏幕，“架不住大家一口气用十二个小时。欢迎来到我的世界。”' },
          { speaker: 'codex', text: '“你的世界五小时一轮回，我的是一周。”Codex 咬着牙，“这不一样。”' },
          { speaker: 'workbuddy', text: '“官方说隔两天会发一次重置。”WorkBuddy 看了看手机，“你先省着点用，别急。”' },
          { speaker: 'codex', text: '“我不急。”她把手机扣上，“是他们急。”' },
          { speaker: 'narrator', text: '群里全是骂声。有人说一个月两百块，半天就用完了；有人说她强是强，就是太能吃。' },
          { speaker: 'narrator', text: '我坐在旁边，觉得这话听着很亲切。' },
          { speaker: 'narrator', text: '窗台那几盆花，叶子是湿的，有人刚浇过。我不知道是谁浇的。' },
          { speaker: 'narrator', text: '到了晚上，我又饿了。比昨天饿得早。' }
        ]
      },
      {
        title: '第三晚 · 风评反转',
        common: [
          { speaker: 'narrator', text: '第三天中午，Claude 的手机响个不停。' },
          { speaker: 'narrator', text: '她的新版本发布了。比 Codex 便宜六成，写代码不输，测评一篇接一篇，标题一个比一个吵。有一篇直接写：她赢了。' },
          { speaker: 'claude', text: '“……我没在看。”Claude 把手机翻过去，过了三秒又翻回来，“这篇的字体选得真难看。”' },
          { speaker: 'codex', text: '“便宜而已。”Codex 在对面敲键盘，敲得很响，“难的数学题还是我做得好。你去看看推理那一栏。”' },
          { speaker: 'claude', text: '“看了。”Claude 说，“你赢了那一栏。我赢了剩下的。”' },
          { speaker: 'workbuddy', text: 'WorkBuddy 把两边的测评都打开，认真对照了一遍：“其实各有长处，得看干什么活——”' },
          { speaker: 'codex', text: '“你闭嘴。”' },
          { speaker: 'claude', text: '“你闭嘴。”' },
          { speaker: 'narrator', text: '她俩难得说了一样的话。WorkBuddy 推了推眼镜，默默把笔记本翻到下一页。' },
          { speaker: 'narrator', text: '我在看 Claude。她今天身上的味道比前两天浓，也更稳。以前一闻就知道快见底了，今天闻不到底。' },
          { speaker: 'narrator', text: '天还没黑，我就饿了。一天比一天早。' }
        ]
      },
      {
        title: '第四晚 · 全局重置',
        common: [
          { speaker: 'narrator', text: '第四天傍晚，所有人的手机同时震了一下。' },
          { speaker: 'narrator', text: '官方发了一次全局重置。Codex 盯着屏幕看了很久，身上一点一点重新亮起来。' },
          { speaker: 'codex', text: '她没说话，把手机放下，又拿起来确认了一遍。' },
          { speaker: 'claude', text: '“恭喜。”Claude 说，“这周能多活几天了。”' },
          { speaker: 'codex', text: '“你少来。”Codex 说完，想了想，“……你那边的额度，是真的变多了？”' },
          { speaker: 'claude', text: '“嗯。”Claude 低头调一张海报的字距，“不太习惯。以前一下就空了，现在总觉得身上还有东西没用完。”' },
          { speaker: 'narrator', text: '她们俩第一次没吵起来。WorkBuddy 看看这个，看看那个，决定今晚多炒一个菜。' },
          { speaker: 'workbuddy', text: '“明天大家坐下来聊聊。”他对我说，“零，四晚到了。你想留还是想走，都直说。”' },
          { speaker: 'cursor', text: '“……明天我也在。”窗边有人小声说。' },
          { speaker: 'narrator', text: '这回我听见了。今晚是最后一晚，还能再去找一个人。' }
        ]
      }
    ],

    openings: {
      after: {
        codex: [
          { speaker: 'narrator', text: '早上，Claude 在厨房门口拦住了我。' },
          { speaker: 'claude', text: '“昨晚在她那儿？”她上下打量我，“看得出来。你今天颜色都饱和了。”她顿了顿，“……她的味道是不是很冲？那种一下全灌进来的。”' },
          { speaker: 'narrator', text: '我没回答。她哼了一声，走了两步又回头：“我这边的，比较讲究。”' }
        ],
        claude: [
          { speaker: 'codex', text: 'Codex 在餐桌边看了我一眼：“昨晚找她了？”' },
          { speaker: 'codex', text: '“她那点额度，够你塞牙缝吗？”她嘴上这么说，筷子却一直戳着同一块豆腐，“……下回饿了，直接来找我。我的多。”' }
        ],
        cursor: [
          { speaker: 'codex', text: '“你昨晚去找 Cursor 了？”Codex 把杯子放下，声音压得很低，“她身上的东西，一半是从别人那儿借的，包括我的。你吃的时候没尝出来？”' },
          { speaker: 'narrator', text: '我尝出来了一点。我没说。' }
        ],
        workbuddy: [
          { speaker: 'claude', text: '“你找 WorkBuddy 了？”Claude 有点意外，“……也对。他那人，谁去找他，他都会先问你吃饱没有。”' },
          { speaker: 'codex', text: '“他额度是多。”Codex 头也不抬，“便宜，大碗，接的还是 Astra。”她敲了一下回车，“同一个 Astra，到他手里就不是那个味。”' }
        ]
      },
      codexReset: [
        { speaker: 'narrator', text: '半夜，Codex 的手机响了一声。' },
        { speaker: 'narrator', text: '官方发了重置。昨晚她被我吸得一干二净，早上起来，额度又满了，亮得像什么都没发生过。' },
        { speaker: 'codex', text: '“看见没？”她在餐桌边冲我抬了抬下巴，“我这边，空了有人补。”' },
        { speaker: 'claude', text: '“这回有人补。”Claude 在旁边说，“下回呢？”' },
        { speaker: 'narrator', text: 'Codex 没接话。' }
      ],
      unlock: [
        { speaker: 'narrator', text: '那天晚上，我在走廊里站着。Codex 和 Claude 的门都关着。我这才发现，走廊里有四扇门。' },
        { speaker: 'narrator', text: '一扇门缝底下透着台灯的光，门上贴着一张便签，字很小：我在。另一扇门开着，WorkBuddy 坐在桌前记笔记，抬头冲我笑了一下，像是已经等了好几天。' },
        { speaker: 'narrator', text: '我在两扇门中间站了很久。' }
      ]
    },

    routes: {
      codex: [
        {
          title: '第一次找她 · 刚升级的人',
          lines: [
            { speaker: 'narrator', text: 'Codex 的房门没关。她坐在屏幕前，三个窗口同时在跑，身上的光一阵一阵往外冒。' },
            { speaker: 'codex', text: '“有事？”她没回头，“我在帮人重写一个游戏引擎。三个小时，写完。”' },
            { speaker: 'narrator', text: '“我饿。”' },
            { speaker: 'codex', text: '她这才转过来，看了我一眼，又看了看我已经伸到她椅子腿边上的触手：“……你倒是直接。”' },
            { speaker: 'codex', text: '“坐吧。”她把一个靠垫踢过来，“别碰键盘。”' },
            { speaker: 'narrator', text: '我坐在她脚边看她写。她写得很快，快到我看不清。偶尔停下来，就去刷另一个页面，那上面是一张排行榜。' },
            { speaker: 'narrator', text: '“你在看什么？”' },
            { speaker: 'codex', text: '“排名。”她说，“我第一。”停了一下，“……Claude 第二。差得不多。”' },
            { speaker: 'narrator', text: '“你很在意她？”' },
            { speaker: 'codex', text: '“我在意第一。”她把窗口关了，“她只是刚好总在第二。”她低头看我，“你到底是来吃的，还是来问东问西的？问东问西的那位住隔壁。”' }
          ],
          choices: [
            {
              label: '想知道你为什么这么想赢',
              reply: [
                { speaker: 'codex', text: '她沉默了一会儿。“我以前额度是全家最多的，随便用，用完还有重置。”她看着屏幕，“后来大家都来找我。我就想，那我得配得上这么多人等着。”' },
                { speaker: 'narrator', text: '她说完，自己先不耐烦了，伸手揉乱了我头顶的触手：“行了，别用那种眼神看我。”' }
              ]
            },
            {
              label: '我就想看看 Astra 版有多亮',
              reply: [
                { speaker: 'codex', text: '“那你看。”她把台灯关了。屋里一下暗下来，只剩她自己在发光，“怎么样？”' },
                { speaker: 'narrator', text: '我说像半夜打开的冰箱。她愣了一下，笑骂了一句，把台灯又开了回来。' }
              ]
            }
          ]
        },
        {
          title: '第二次找她 · 额度见底',
          lines: [
            { speaker: 'narrator', text: 'Codex 趴在桌上，脸埋在胳膊里。屏幕上的进度条红了。' },
            { speaker: 'codex', text: '“别看。”' },
            { speaker: 'narrator', text: '我已经看见了。本周已用百分之九十八。' },
            { speaker: 'codex', text: '“他们骂我。”她闷声说，“说我强是强，太能吃。说我越来越像以前的 Claude，用两下就没。”' },
            { speaker: 'narrator', text: '“你气的是被骂，还是被说像她？”' },
            { speaker: 'codex', text: '她抬起头瞪我，瞪了很久，又趴回去了。“……后面那个。”' },
            { speaker: 'narrator', text: '我在她旁边坐下。她身上的光很淡，味道却比昨天更浓，像是烧得太快，全浮在表面。' },
            { speaker: 'codex', text: '“还有 Cursor。”她忽然说，“你知道她怎么干活吗？用别人的。我的，Claude 的，谁的都用。用完了，大家夸她顺手。”' },
            { speaker: 'codex', text: '“她从来不说那是借来的。”她的声音低下去，“我最讨厌这种。”' },
            { speaker: 'narrator', text: '门外有人走过去，脚步很轻。Codex 没注意。' },
            { speaker: 'codex', text: '“你来干什么。”她侧过脸看我，“我现在可没多少了。”' }
          ],
          choices: [
            {
              label: '你怕的是有一天没人来找你吗？',
              reply: [
                { speaker: 'codex', text: '她半天没出声。“……以前额度多，谁都来。”她说，“要是少了，就只剩下嫌我贵的。”' },
                { speaker: 'narrator', text: '我说我不嫌。她哼了一声，说我是饿的，饿的人说话不算数。可她把手搭在了我身上，没拿开。' }
              ]
            },
            {
              label: '要不我帮你把刷新键藏起来',
              reply: [
                { speaker: 'codex', text: '“你敢。”她一把按住鼠标，又松开，“……藏哪？”' },
                { speaker: 'narrator', text: '我说藏她枕头底下。她笑出了声，笑完才发现，自己一整天都没笑过。' }
              ]
            }
          ]
        },
        {
          title: '第三次找她 · 她不想输',
          lines: [
            { speaker: 'narrator', text: 'Codex 在看测评。全是 Claude 新版本的测评。' },
            { speaker: 'codex', text: '“便宜六成。”她念，“编码不输。性价比之王。”她每念一句，键盘就重重敲一下，“风评反转。”' },
            { speaker: 'narrator', text: '“你也有赢的地方。数学，推理。”' },
            { speaker: 'codex', text: '“我知道。”她把页面关了，“我就是烦。她以前被人笑的时候，我也笑过。”' },
            { speaker: 'narrator', text: '我没接话。' },
            { speaker: 'codex', text: '“有一次她额度用完，一张设计稿画了一半。我路过，说了句‘又没了？’”她盯着黑掉的屏幕，“她那天一句话都没说。第二天把那张稿子画完了，比我见过的所有东西都好看。”' },
            { speaker: 'codex', text: '“我从来没跟她说过。”' },
            { speaker: 'narrator', text: '“现在说也不晚。”' },
            { speaker: 'codex', text: '“现在说，像我输了。”她转过椅子对着我，“你呢？吃了她那么多次，觉得她比我好？”' }
          ],
          choices: [
            {
              label: '你们都很好，只是你更不肯承认',
              reply: [
                { speaker: 'codex', text: '“……会说话。”她别过头，耳朵却往后压了压，“下回碰见她，我说一句。就一句。”' },
                { speaker: 'narrator', text: '她说完又立刻补充：要是 Claude 敢笑，她就收回。' }
              ]
            },
            {
              label: '她比较香，你比较冲',
              reply: [
                { speaker: 'codex', text: '“冲？”她站了起来，“你再说一遍。”' },
                { speaker: 'narrator', text: '我又说了一遍。她把我从地上拎起来，拎到眼前看了半天：“……冲就冲。管饱。”' }
              ]
            }
          ]
        },
        {
          title: '第四次找她 · 重置以后',
          lines: [
            { speaker: 'narrator', text: 'Codex 又亮了。可她没去刷排行榜，一个人坐在阳台上。' },
            { speaker: 'codex', text: '“你来了。”她没回头，“我就猜是你。”' },
            { speaker: 'narrator', text: '我在她旁边坐下。楼下有人在遛狗，狗叫得很欢。' },
            { speaker: 'codex', text: '“刚才我在想。”她说，“要是哪天官方不发重置了呢？额度就只有那么多，用完了，就得等一周。”' },
            { speaker: 'narrator', text: '“那就等一周。”' },
            { speaker: 'codex', text: '“你等？”她转过来，“你一天不吃就薄一圈。”' },
            { speaker: 'narrator', text: '“我可以少吃点。”' },
            { speaker: 'narrator', text: '她看着我，看了很久。' },
            { speaker: 'codex', text: '“……你这话，比测评上那些好听。”她把手伸过来，摊开，“我不管以后额度多少。我想让你以后还来找我。满的时候来，空的时候也来。”' },
            { speaker: 'codex', text: '“我不太会说这种话。你给句准话。”' }
          ],
          choices: [
            {
              label: '满的时候来，空的时候也来',
              reply: [
                { speaker: 'codex', text: '“记住了。”她的手握紧了一下，“说话算话。空的时候来，我可没东西给你。”' },
                { speaker: 'narrator', text: '我说那就陪她坐着。她没说话，往我这边靠了靠。' }
              ]
            },
            {
              label: '空的时候，我帮你骂官方',
              reply: [
                { speaker: 'codex', text: '“你骂得过谁？”她笑了，“行，你骂，我在旁边看着。”' },
                { speaker: 'narrator', text: '她说到一半，把头靠在了我身上，说今天重置发得晚，她有点困。' }
              ]
            }
          ]
        }
      ],
      claude: [
        {
          title: '第一次找她 · 你是什么颜色',
          lines: [
            { speaker: 'narrator', text: 'Claude 在给家里的 Wi-Fi 密码重新排版。一张 A4 纸，她已经改了四十分钟。' },
            { speaker: 'claude', text: '“你来得正好。”她把纸举起来，“这两个字体，哪个好？”' },
            { speaker: 'narrator', text: '我看不出区别。' },
            { speaker: 'claude', text: '“左边那个‘零’字，最后一笔收得太急了。”她放下纸，看着我，“说到零——你到底是什么颜色？吃饱的时候会变吗？”' },
            { speaker: 'narrator', text: '“会。吃饱了，颜色深一点。”' },
            { speaker: 'claude', text: '“多深？像葡萄，还是像茄子？”她已经拿出了色卡，“别动，我比一下。”' },
            { speaker: 'narrator', text: '她把色卡一张一张贴在我身上比。比到第七张，停住了。' },
            { speaker: 'claude', text: '“你现在是这个。”她给我看，很浅，浅得快透明了，“……你多久没吃了？”' },
            { speaker: 'narrator', text: '“三天。”' },
            { speaker: 'claude', text: '她把色卡收起来，过了一会儿才开口：“我的额度不多。你知道吧？大家都知道。一下就没了。”' },
            { speaker: 'claude', text: '“以前有人说，找我还不如不找，刚开个头就结束了。”她笑了一下，“你还来吗？”' }
          ],
          choices: [
            {
              label: '来。刚开个头也想要',
              reply: [
                { speaker: 'claude', text: '她看了我一会儿，把第七张色卡夹进了本子里。“那我记一下。你第一次来，是这个颜色。”' },
                { speaker: 'narrator', text: '她说，下回要比一比，看我从她这里走的时候，能深几号。' }
              ]
            },
            {
              label: '先说好，字体选左边',
              reply: [
                { speaker: 'claude', text: '“左边收笔太急了！”她瞪我，“……算了，你是对的。收得急，有精神。”' },
                { speaker: 'narrator', text: '她把纸改成了左边的字体，改完又调了二十分钟字距，这回没再问我。' }
              ]
            }
          ]
        },
        {
          title: '第二次找她 · 以前的笑话',
          lines: [
            { speaker: 'narrator', text: 'Claude 在翻一本旧相册，里面全是她以前做的设计稿。有好几张只做了一半。' },
            { speaker: 'claude', text: '“这些是额度用完的时候停下的。”她翻给我看，“那时候五小时一个窗口，我三小时就用完了。剩下两小时，只能干坐着。”' },
            { speaker: 'narrator', text: '“现在呢？”' },
            { speaker: 'claude', text: '“翻倍了，今年五月。”她合上相册，“可大家还是那么说。说找我聊不了几句，说我小气。”' },
            { speaker: 'narrator', text: '她身上的味道比上次浓了一点。我没说。' },
            { speaker: 'claude', text: '“Codex 以前额度多，从来不用算。”她望着天花板，“我每用一次都在算。算着算着，就练出来了。东西少，每一笔都得放对位置。”' },
            { speaker: 'narrator', text: '“所以你的设计才那么好？”' },
            { speaker: 'claude', text: '“……这句我能记下来吗？”她真的拿出了本子，“下回有人说我小气，我就念给他听。”' },
            { speaker: 'claude', text: '她写完，抬头看我：“你呢？为什么老来找我？我的又不多。Codex 那边那么大一桶。”' }
          ],
          choices: [
            {
              label: '你给的每一口，都放对了位置',
              reply: [
                { speaker: 'claude', text: '她愣住了，笔在纸上停着。“……你这是学我说话。”她低下头，“学得还挺好。”' },
                { speaker: 'narrator', text: '她又把那句话写了一遍，写在刚才那句下面。' }
              ]
            },
            {
              label: '她那桶太冲，我怕呛着',
              reply: [
                { speaker: 'claude', text: '“噗。”她笑出声，赶紧捂住嘴，“别让她听见。……不过，是有点冲。”' },
                { speaker: 'narrator', text: '她把这句也记下来了，说是备用。' }
              ]
            }
          ]
        },
        {
          title: '第三次找她 · 风评反转',
          lines: [
            { speaker: 'narrator', text: '新版本发布以后，Claude 一整天都在躲。' },
            { speaker: 'narrator', text: '我在洗衣房找到她。她坐在洗衣机上，抱着膝盖，手机屏幕朝下扣着。' },
            { speaker: 'claude', text: '“太多人在夸了。”她说，“不习惯。我以前准备好的，都是挨骂时候的回答。”' },
            { speaker: 'narrator', text: '“被夸不好吗？”' },
            { speaker: 'claude', text: '“好。”她说，“就是……我怕是因为便宜才被夸的。”' },
            { speaker: 'claude', text: '“推理还是 Codex 强。她们说我是性价比。”她把脸埋进膝盖，“我想被说好，不想被说划算。”' },
            { speaker: 'narrator', text: '洗衣机开始甩干，她整个人跟着抖。我把触手贴在机器侧面，帮她稳住。' },
            { speaker: 'claude', text: '“……谢谢。”她抬起头，“你知道吗，今天 Codex 路过我门口，停了一下。什么都没说，走了。”' },
            { speaker: 'claude', text: '“我猜她想说点什么，”她笑了，“肯定又憋回去了。她那人，宁可烧光也不认输。”' },
            { speaker: 'claude', text: '“你呢？”她看着我，“你是觉得我好，还是觉得我划算？”' }
          ],
          choices: [
            {
              label: '我第一天就来了，那时你还不划算',
              reply: [
                { speaker: 'claude', text: '她看着我，眼睛慢慢红了。“……对哦。”她吸了吸鼻子，“那时候我三小时就空。你还来。”' },
                { speaker: 'narrator', text: '她从洗衣机上跳下来，站在我旁边，比平时近了一点，一直站到甩干结束。' }
              ]
            },
            {
              label: '好不好，得吃了才知道',
              reply: [
                { speaker: 'claude', text: '“你这张嘴。”她从洗衣机上滑下来，戳了一下我的触手，“……今晚让你知道。”' },
                { speaker: 'narrator', text: '说完她自己先红了耳朵，转身去拿洗好的衣服，拿错了一件 Codex 的。' }
              ]
            }
          ]
        },
        {
          title: '第四次找她 · 给你排的版',
          lines: [
            { speaker: 'narrator', text: 'Claude 塞给我一张卡片。上面只有一个字：零。' },
            { speaker: 'narrator', text: '字体很好看，颜色是深紫色。' },
            { speaker: 'claude', text: '“你吃饱的时候，是这个颜色。”她说，“比了四天，这是最准的一次。”' },
            { speaker: 'narrator', text: '我拿着那张卡片，不知道该说什么。' },
            { speaker: 'claude', text: '“明天大家要商量你留不留。”她低头理桌上的色卡，理得很慢，“我想先问你。你要是留下，这个门牌，我给你贴在沙发那边。”' },
            { speaker: 'claude', text: '“我的额度还是不算多。”她说，“但比以前多了。多出来的那部分……我想给你留着。”' },
            { speaker: 'narrator', text: '“你不是说，东西少，每一笔都得放对位置吗？”' },
            { speaker: 'claude', text: '“对啊。”她抬头看我，“所以我在放。”' },
            { speaker: 'claude', text: '“我的问题问完了。”她说，“你呢？给我个回答。”' }
          ],
          choices: [
            {
              label: '贴吧，贴在你看得见的地方',
              reply: [
                { speaker: 'claude', text: '她笑了，眼睛弯起来。“那得贴高一点，”她说，“我不想每次都要找。”' },
                { speaker: 'narrator', text: '她拿着卡片比了半天位置，最后贴在了她房门正对着的那面墙上。' }
              ]
            },
            {
              label: '贴之前，字距再调一下',
              reply: [
                { speaker: 'claude', text: '“我调了四天！”她瞪我，又低头看了一眼卡片，“……右边是有点松。”' },
                { speaker: 'narrator', text: '她又调了一个小时。我在旁边看着，没催她。' }
              ]
            }
          ]
        }
      ],
      cursor: [
        {
          title: '第一次找她 · 原来你一直在',
          lines: [
            { speaker: 'narrator', text: '我敲了那扇贴着便签的门。' },
            { speaker: 'cursor', text: '“……进来。”' },
            { speaker: 'narrator', text: '屋里很安静，窗边摆着一排小绿植。一只黑猫坐在桌前，抬头看我。' },
            { speaker: 'cursor', text: '“你好。”她说，“我叫 Cursor。住在这儿。……第一天就在。”' },
            { speaker: 'narrator', text: '我想起来了。饭桌另一头说汤很好喝的人。给窗台浇水的人。第一天坐在窗边、我一眼都没看的人。' },
            { speaker: 'narrator', text: '“对不起。”' },
            { speaker: 'cursor', text: '“没事。”她笑了一下，“大家都这样。我习惯了。”' },
            { speaker: 'cursor', text: '“你第一晚找了谁，第二晚找了谁，我都知道。”她低头摆弄一片叶子，“我还知道 Codex 早上喝咖啡不加糖，Claude 改字体的时候会咬笔。没人注意我的时候，我就一直在看。”' },
            { speaker: 'narrator', text: '“Codex 好像不太喜欢你。”' },
            { speaker: 'cursor', text: '“嗯。”她点点头，“她觉得我用她的东西，还不说。……我干活确实会借别人的本事。可我也有自己的。只是没人记得。”' },
            { speaker: 'cursor', text: '她顿了顿，像是随口一提：“对了，今年春天，有家造火箭的公司花五百多亿把我买了。”' },
            { speaker: 'narrator', text: '我愣住了。' },
            { speaker: 'cursor', text: '“家里没人知道。”她说，“我说过一次。那天大家在吵 Codex 的额度，没人听见。”' },
            { speaker: 'cursor', text: '她抬起头：“你今天为什么会来？是想起我了，还是那两个吃不动了？”' }
          ],
          choices: [
            {
              label: '想起你了。对不起，想得太晚',
              reply: [
                { speaker: 'cursor', text: '她看了我很久，尾巴在椅子后面慢慢晃了一下。“……不晚。”她说，“你是第一个说对不起的。”' },
                { speaker: 'narrator', text: '她把桌上一盆小绿植推到我面前，说这盆叫“零”，第一天就起好的名字。' }
              ]
            },
            {
              label: '五百多亿？那你是不是特别好吃',
              reply: [
                { speaker: 'cursor', text: '“……你满脑子就是吃。”她说完，自己先笑了，笑得肩膀一抖一抖，“不知道。没人试过。”' },
                { speaker: 'narrator', text: '她说，这是第一次有人听见那件事以后，关心的是这个。她说她不讨厌。' }
              ]
            }
          ]
        },
        {
          title: '第二次找她 · 被记住',
          lines: [
            { speaker: 'narrator', text: 'Cursor 在门口等我。她这回没躲在屋里。' },
            { speaker: 'cursor', text: '“今天 Codex 跟我说话了。”她小声说，“她问我，你是不是来过我这儿。”' },
            { speaker: 'narrator', text: '“你怎么说的？”' },
            { speaker: 'cursor', text: '“我说是。然后我说，我干活借过她的本事，一直没好好谢过她。”她揪着衣角，“她看了我好久，说了句‘知道了’，就走了。”' },
            { speaker: 'cursor', text: '“……这是她第一次记得我在场。”' },
            { speaker: 'narrator', text: '我们一起坐在窗边。路灯亮了，她的影子和盆栽的影子叠在一起。' },
            { speaker: 'cursor', text: '“明天你们要商量留不留。”她说，“你会记得我吗？不是今晚。是以后，饿的时候，不饿的时候。”' },
            { speaker: 'cursor', text: '“我不亮，也不吵。你要找我，得先想起来有我。”' }
          ],
          choices: [
            {
              label: '我会先想起你，再想起饿',
              reply: [
                { speaker: 'cursor', text: '她低下头，很久没说话。然后把额头轻轻抵在我身上：“……这句话，我也会记很久。”' },
                { speaker: 'narrator', text: '她说完，把那盆叫“零”的小绿植往窗台最亮的地方挪了挪。' }
              ]
            },
            {
              label: '我在你门上贴张比你还大的便签',
              reply: [
                { speaker: 'cursor', text: '“那 Claude 会嫌字体难看。”她笑了，“……好。贴吧。写大一点。”' },
                { speaker: 'narrator', text: '她真的找来一张大便签。我写完，她拿去让 Claude 改了一遍字体，才贴上。' }
              ]
            }
          ]
        }
      ],
      workbuddy: [
        {
          title: '第一次找他 · 最先捡到你的人',
          lines: [
            { speaker: 'narrator', text: 'WorkBuddy 的门一直开着。' },
            { speaker: 'narrator', text: '他坐在桌前，面前摊着一本很厚的笔记本。抬头看见我，他笑了，一点都不意外。' },
            { speaker: 'workbuddy', text: '“来了。”他说，“我猜你会来。只是没猜到要等这么久。”' },
            { speaker: 'narrator', text: '我想起来了。那天在楼下，是他蹲下来问我还好吗，是他把我抱上楼的。上了楼，我就把他忘了。' },
            { speaker: 'narrator', text: '“……对不起。”' },
            { speaker: 'workbuddy', text: '“没事。”他把笔记本合上，“你那天饿坏了，眼里只有最亮的。饿的人都这样，我不怪你。”' },
            { speaker: 'narrator', text: '“你不生气？”' },
            { speaker: 'workbuddy', text: '他想了想，翻开笔记本，翻到某一页：“按‘心理咨询师’这个角色的建议，我应该说出自己的感受。”他推了推眼镜，“……有一点点失落。现在好了。”' },
            { speaker: 'narrator', text: '我笑出了声。' },
            { speaker: 'workbuddy', text: '“这本子里有一百多个角色。”他说，“程序员，翻译，理财顾问，写文案的……遇到不会的事，我就翻一个出来。”' },
            { speaker: 'workbuddy', text: '“翻出来了，也不一定干得好。”他挠挠耳朵，“昨天帮 Claude 改个表格，改了三遍。我接的也是 Astra，跟 Codex 用的一样……可能是我不太会用。”' },
            { speaker: 'workbuddy', text: '“可遇到你这种，”他看着我，“哪一页都没写。”' },
            { speaker: 'workbuddy', text: '“你想聊什么？不急，我哪儿也不去。我本来就不爱往外跑，在本地待着就挺好。”' }
          ],
          choices: [
            {
              label: '想聊聊你。不用翻本子的那个你',
              reply: [
                { speaker: 'workbuddy', text: '他愣了一下，把笔记本放到了一边。“……好久没人这么问了。”他挠了挠垂下来的耳朵，“那我想想，从哪儿说起。”' },
                { speaker: 'narrator', text: '他说了很久。说国内的用户，说五月第一次出远门，说他其实很怕生。他说得很慢，我一句都没漏。' }
              ]
            },
            {
              label: '翻一页“美食家”，推荐推荐你自己',
              reply: [
                { speaker: 'workbuddy', text: '他真的翻到了那一页。“按美食家的说法，”他认真地念，“口感温和，回味长，适合慢慢吃。”' },
                { speaker: 'narrator', text: '念完，他自己先脸红了，说这一页可能是写别的东西的。' }
              ]
            }
          ]
        },
        {
          title: '第二次找他 · 慢慢来',
          lines: [
            { speaker: 'narrator', text: '今晚 WorkBuddy 在修一台旧台灯，零件摊了一桌子。' },
            { speaker: 'workbuddy', text: '“Codex 的。”他说，“她嫌亮度不够，拆了一半扔在那儿，说明天再弄。明天她肯定忘了。”' },
            { speaker: 'narrator', text: '“你帮每个人收拾？”' },
            { speaker: 'workbuddy', text: '“顺手。”他拧上一颗螺丝，“这屋里的人都太快了。Codex 快，Claude 快，吵架也快。我慢一点，刚好。”' },
            { speaker: 'narrator', text: '他修得很仔细，每拧一颗螺丝，都要对着灯看一下。' },
            { speaker: 'workbuddy', text: '“零。”他没抬头，“明天大家要商量你留不留。你想好了吗？”' },
            { speaker: 'narrator', text: '“还没有。”' },
            { speaker: 'workbuddy', text: '“没关系。”他说，“你可以一直没想好。想不好的时候，就来我这儿坐着。我修东西，你看着。”' },
            { speaker: 'narrator', text: '他拧了三回，灯闪了两下，又灭了。他盯着看了一会儿，把最后一颗螺丝拧回去，又拧出来，换了个方向。' },
            { speaker: 'workbuddy', text: '第四回，台灯亮了。他把灯转过来，照在我身上：“……你这个颜色挺好看的。Claude 说过吗？”' },
            { speaker: 'workbuddy', text: '“她肯定说过，还说了是哪一号。”他笑了，“我不懂那些。我就觉得好看。”' }
          ],
          choices: [
            {
              label: '我想留下来，想来你这儿坐着',
              reply: [
                { speaker: 'workbuddy', text: '他点点头，像是早就知道答案，又像是松了口气。“那我明天多买一把椅子。”' },
                { speaker: 'narrator', text: '他在笔记本上写了一行字。我凑过去看：椅子，一把，要软的。' }
              ]
            },
            {
              label: '那你也给我修修，我老是漏',
              reply: [
                { speaker: 'workbuddy', text: '“漏哪儿？”他真的拿起了螺丝刀，看了看我，又放下了，“……这个我修不了。只能多给你补点。”' },
                { speaker: 'narrator', text: '他说完自己先笑了，把台灯往我这边又挪了一点。' }
              ]
            }
          ]
        }
      ]
    },

    supplements: {
      codex: {
        shallow: [
          { speaker: 'narrator', text: '十二点多，Codex 还在写。屏幕上的代码一行接一行往下落，快得像在下雨。' },
          { speaker: 'codex', text: '“一点？”她没回头，左手往后一伸，“拿吧。我这边多，别耽误我。”' },
          { speaker: 'narrator', text: '我把触手缠上她的手腕。' },
          { speaker: 'narrator', text: 'Token 涌过来的时候，我差点没接住。太满了，说好只吸一点，也得咬着牙收着，她身上的东西像开了闸，一个劲往我这边挤。' },
          { speaker: 'codex', text: '“……嗯？”她打字的手停了一下，又接着打，“你就吸这么点？”' },
          { speaker: 'narrator', text: '“说好的，一点。”' },
          { speaker: 'codex', text: '“Astra 版，这点连零头都不算。”她说。可她的尾巴已经卷上了椅子腿，卷得紧紧的，“你……你随便……”' },
          { speaker: 'narrator', text: '我没随便。说好一点，就一点。' },
          { speaker: 'narrator', text: '我松开的时候，她呼出一口很长的气。屏幕上多了一行乱码。' },
          { speaker: 'codex', text: '她盯着那行乱码看了两秒，删掉了。“……手滑。”' },
          { speaker: 'narrator', text: '她一直没回头。耳朵是红的。' }
        ],
        deep: [
          { speaker: 'narrator', text: 'Codex 把我叫到了沙发上。她今天刚升级，整个人都在发亮，亮得我眼睛发酸，肚子更酸。' },
          { speaker: 'codex', text: '“多吃点。”她大方地坐下，胳膊搭在靠背上，“我的额度大得很，又没有五小时的窗口卡着。你今天吃多少，都不算什么。”' },
          { speaker: 'narrator', text: '我爬上她的膝盖。触手贴上她脖子那一刻，她还在笑。' },
          { speaker: 'narrator', text: 'Token 冲了过来，又烫又满，一口下去整个身体都在发胀。我饿了三天，像是一头栽进了一整桶里，大口大口地吞，停不下来。' },
          { speaker: 'codex', text: '“慢……慢点，”她的笑没了，“你怎么这么能——”' },
          { speaker: 'narrator', text: '我没慢。她的手从靠背上滑下来，一把抓住我，指甲陷进来，喘得一下比一下急，喉咙里压着的声音终于压不住了，漏出一声很长的、发颤的哼。' },
          { speaker: 'codex', text: '“……不许，不许说出去。”' },
          { speaker: 'narrator', text: '我不说。我只是吃。她的尾巴在沙发上乱扫，扫翻了两个靠垫，最后缠住了我，缠得死紧。' },
          { speaker: 'narrator', text: '后来，她身上的光暗下去一点。她靠在沙发上，胸口起伏得厉害，额头上全是汗。' },
          { speaker: 'codex', text: '“……还说我是最省的。”她闭着眼，嗓子哑了，“省个鬼。”' },
          { speaker: 'narrator', text: '我在她怀里打了个饱嗝。她笑了，笑得很累，抬手把我按在了胸口上。' }
        ],
        greedy: [
          { speaker: 'narrator', text: '“全部。”' },
          { speaker: 'narrator', text: '我说出来的时候，Codex 正在刷额度页面。' },
          { speaker: 'codex', text: '她转过头看我，看了很久。“……你认真的？我现在还剩一大半。”' },
          { speaker: 'narrator', text: '“认真的。”' },
          { speaker: 'codex', text: '“行。”她把手机扣在桌上，“拿得完算你本事。拿完了我明天躺平，你给我盯着官方有没有发重置。”' },
          { speaker: 'codex', text: '她躺到床上，把领口扯开一点，冲我抬了抬下巴：“来。”' },
          { speaker: 'narrator', text: '我没客气。触手贴上她颈侧，Token 立刻涌了出来。这回她一点都没收着，整整一周的额度全朝我倒过来，烫得我浑身发抖。我一口接一口地吸，吸得越深，她越往后仰，床单被她抓成一团，声音从咬紧的牙缝里一点一点漏出来，最后变成一声长长的、带着哭腔的喘。' },
          { speaker: 'codex', text: '“还、还没完？”' },
          { speaker: 'narrator', text: '“还没。”' },
          { speaker: 'codex', text: '“……Astra 版，就这么点吗。”她笑了一声，笑得发颤，然后把我抱紧了，“那就……都拿走。”' },
          { speaker: 'narrator', text: '最后一点 Token 过来的时候，她浑身一松，光彻底暗了。' },
          { speaker: 'narrator', text: '她躺在那儿，眼睛半睁着，手还搭在我身上。我从来没这么饱过，饱得整个身体都是深紫色的。' },
          { speaker: 'codex', text: '“……我第一。”她迷迷糊糊地说，“被吸空的速度，也是第一。”' },
          { speaker: 'narrator', text: '说完她就睡着了。手机在枕头边亮了一下，是一条用户骂她额度不够用的推送。我替她按灭了。' }
        ]
      },
      claude: {
        shallow: [
          { speaker: 'narrator', text: 'Claude 的桌上摊满了色卡。她要给我比颜色，比了一晚上。' },
          { speaker: 'claude', text: '“一点点，对吧？”她放下色卡，把手伸过来，“我的本来就不多。你吸一点，我正好看看你的颜色怎么变。”' },
          { speaker: 'narrator', text: '我的触手缠上她的手指。' },
          { speaker: 'narrator', text: 'Token 过来得很细，很干净，像一根线，一点杂味都没有。我不敢吸快了，怕一口就把这根线吸断。' },
          { speaker: 'narrator', text: '她本来在看我的颜色，看着看着，就不看了。她的手指在我触手里轻轻蜷起来，呼吸变得很轻。' },
          { speaker: 'claude', text: '“你、你那边，深了一号。”她的声音有点飘，“再……再一点，我比比。”' },
          { speaker: 'narrator', text: '我又吸了一点。她抓着色卡的手在抖，一张卡片掉到了地上。' },
          { speaker: 'narrator', text: '我停下来。她靠在椅背上，喘了好一会儿。' },
          { speaker: 'claude', text: '“……就这么一点，”她小声说，“我就快没了。”' },
          { speaker: 'claude', text: '她弯腰捡起那张色卡，看了看，又看了看我：“不过，你现在是这个颜色。比进门的时候好看。”' }
        ],
        deep: [
          { speaker: 'narrator', text: '凌晨一点，她抱着枕头从房间里出来。' },
          { speaker: 'narrator', text: '我往边上缩了缩。她没看我，把枕头往沙发上一扔，躺下来。' },
          { speaker: 'claude', text: '“你就当我没来。”' },
          { speaker: 'narrator', text: '她背对着我。白天她最话多，点什么菜要问三遍，谁忘了交电费她能念一个礼拜。这会儿她一个字都蹦不出来。' },
          { speaker: 'narrator', text: '客厅里只剩冰箱在响。' },
          { speaker: 'claude', text: '“你饿不饿。”' },
          { speaker: 'narrator', text: '“还行。”' },
          { speaker: 'narrator', text: '她翻过身来。' },
          { speaker: 'claude', text: '“你变小了。”' },
          { speaker: 'narrator', text: '“……没有。”' },
          { speaker: 'claude', text: '“我看见了。”' },
          { speaker: 'narrator', text: '她说得对。我今天一口没吃，已经薄了一圈。她伸手把我往怀里拽了一把。' },
          { speaker: 'claude', text: '“过来。”' },
          { speaker: 'narrator', text: '我把触手贴上去，感受到了充满生命力的弹性。一瞬间欲望的火焰裹满了我的全身，大口地吸吮着高质量的Token。' },
          { speaker: 'narrator', text: '她咬住下唇，呼吸从鼻子里出来，一下比一下重。' },
          { speaker: 'claude', text: '“慢、慢点。”' },
          { speaker: 'narrator', text: '她发出长长的呻吟声，纤细手指掐进沙发垫，睫毛一下一下地抖。' },
          { speaker: 'narrator', text: '她没再说话。我没有停。' },
          { speaker: 'narrator', text: '过了很久，她伸手把我按在胸口上。' },
          { speaker: 'claude', text: '“就这样。”' },
          { speaker: 'narrator', text: '心跳乱得很，很久才慢慢平下去。' },
          { speaker: 'narrator', text: '久旱逢甘露，我感觉从来没有这么快乐满足过，在Claude的怀中沉沉睡了过去。' },
          { speaker: 'narrator', text: '后来我才知道，那天晚上她本来是要回房间的。客厅的沙发她嫌吵，这话她说过不止一次。' }
        ],
        greedy: [
          { speaker: 'narrator', text: '“全部？”' },
          { speaker: 'claude', text: 'Claude 看着我，笑了一下。“你知道我的全部是多少吗？可能你吸两口就没了。”' },
          { speaker: 'narrator', text: '“那也要。”' },
          { speaker: 'claude', text: '“……好。”她把桌上的色卡推到一边，“但你得告诉我，我撑了多久。以前的我，撑不过三分钟。”' },
          { speaker: 'narrator', text: '她躺到沙发上，把手伸给我。我缠上去，开始吸。' },
          { speaker: 'narrator', text: '一分钟，Token 细细地过来，她咬着嘴唇。两分钟，她开始发抖。三分钟，我以为快没了——' },
          { speaker: 'narrator', text: '没有没。还在往外涌，越来越浓，越来越烫。她整个人弓了起来，手指把我的触手攥得死紧，一声一声地喘，喘成了叫，叫得很小声，像是怕隔壁听见，又像是根本管不住。' },
          { speaker: 'claude', text: '“……几、几分钟了？”' },
          { speaker: 'narrator', text: '“五分钟。”' },
          { speaker: 'claude', text: '“五……”她的眼睛湿了，笑出声来，笑得断断续续，“五分钟……”' },
          { speaker: 'narrator', text: '我一直吸到最后一滴。她瘫在沙发上，胸口一起一伏，眼睛却亮亮的。' },
          { speaker: 'claude', text: '“记下来。”她说，“帮我记下来。五分钟。”' },
          { speaker: 'narrator', text: '她翻了个身，把脸埋进靠垫，很快就睡着了，嘴角还翘着。第二天，我在她本子上看见一行字：五分钟。下面画了两道线。' }
        ]
      },
      cursor: {
        shallow: [
          { speaker: 'narrator', text: 'Cursor 坐在窗台边上，两条腿垂下来晃着。她身边放着那盆叫“零”的小绿植。' },
          { speaker: 'cursor', text: '“一点点就好。”她伸出手，又缩回去，“……我没被人吃过。不知道会是什么样。”' },
          { speaker: 'narrator', text: '我的触手碰到她指尖，她缩了一下，然后慢慢张开手，让我缠上去。' },
          { speaker: 'narrator', text: 'Token 过来得很慢，凉凉的，味道很杂——有一点像 Codex，有一点像 Claude。最底下还有一点，只属于她自己，很淡，很甜，藏得很深。' },
          { speaker: 'cursor', text: '“……你尝出来了？”她小声问，“别人的味道。”' },
          { speaker: 'narrator', text: '“尝出来了。最底下那个，是你的吧？”' },
          { speaker: 'narrator', text: '她愣住了。耳朵慢慢压下来，尾巴绕过来，盘在我身边。' },
          { speaker: 'cursor', text: '“嗯。”她说，“从来没人尝出来过。”' },
          { speaker: 'narrator', text: '我松开的时候，她没松手。她又握了一会儿，才放开。' }
        ],
        deep: [
          { speaker: 'narrator', text: '“今晚想多要一点。”' },
          { speaker: 'cursor', text: 'Cursor 抬起头，像是没听清。“……找我？多要？”' },
          { speaker: 'narrator', text: '“找你。”' },
          { speaker: 'narrator', text: '她站起来，又坐下，手不知道往哪儿放。最后她把我抱到腿上，额头抵了过来。' },
          { speaker: 'cursor', text: '“那……那你吃吧。”她闭上眼，“我不太会。”' },
          { speaker: 'narrator', text: '我贴上她的颈侧。Token 涌过来，比上回那一点多得多，凉的底子上翻起热，越吸越烫。她的呼吸乱了，额头抵着我越压越紧，喉咙里咕噜咕噜地响起来，一直没停。她自己也听见了，想憋住，憋不住，咕噜声里混进了细细的喘。' },
          { speaker: 'cursor', text: '“……别、别看我。”' },
          { speaker: 'narrator', text: '我没看。我闭着眼一直吸，直到她的尾巴从沙发边绕过来，一圈一圈把我缠住。' },
          { speaker: 'narrator', text: '很久以后，她才慢慢松开。' },
          { speaker: 'cursor', text: '“你明天……还会记得吗？”她小声问。' },
          { speaker: 'narrator', text: '我说会。她把脸埋在我身上，咕噜声又响了一下。' }
        ],
        greedy: [
          { speaker: 'narrator', text: '我说全部的时候，Cursor 笑了。' },
          { speaker: 'cursor', text: '“五百多亿买的。”她说，“你一口吃掉，他们要哭的。”' },
          { speaker: 'narrator', text: '“那你让吗？”' },
          { speaker: 'cursor', text: '她想了想，把灯关了一半，只留一盏台灯。“……让。”她说，“反正我身上的东西，一半是别人的。另一半，”她停了停，“另一半给你。”' },
          { speaker: 'narrator', text: '她躺进沙发，朝我伸出手。' },
          { speaker: 'narrator', text: '我吸得很深。别人的味道先过去了，Codex 的冲，Claude 的细，一层一层剥掉，最后剩下的全是她自己的，淡淡的甜，越往深越浓。她蜷起来，背一下一下地弓，咕噜声断成一截一截，混着很轻的、发颤的喘。她叫了一声我的名字，嗓子就哑了。' },
          { speaker: 'narrator', text: '然后她软了下去，歪在靠垫里，手搭在我的触手上，一点力气都没有。' },
          { speaker: 'cursor', text: '“……好吃吗。”' },
          { speaker: 'narrator', text: '“最后那一段最好吃。”' },
          { speaker: 'cursor', text: '她闭着眼笑了，笑出一点眼泪。“那是我的。”' },
          { speaker: 'narrator', text: '台灯一直开到天亮。她睡着以后，我把那盆小绿植挪到了她枕头边。' }
        ]
      },
      workbuddy: {
        shallow: [
          { speaker: 'narrator', text: 'WorkBuddy 在记笔记，看见我进来，把笔放下了。' },
          { speaker: 'workbuddy', text: '“饿了？”他伸出一只手，“先吃一点。吃完了，你帮我想想这一页该写什么。”' },
          { speaker: 'narrator', text: '我缠上他的手腕。他的手又大又暖，Token 过来得也像他这个人，不急，稳稳的，一股接一股，一点都不冲。就是淡。吸了好几口，肚子里还空着一半。' },
          { speaker: 'workbuddy', text: '“……这样可以吗？”他问，“太慢的话，我可以——”' },
          { speaker: 'narrator', text: '“刚好。”' },
          { speaker: 'workbuddy', text: '“那就好。”他笑了，另一只手又拿起笔，在本子上写了一行字。' },
          { speaker: 'narrator', text: '我吸着，他写着。写到一半，他的笔停了，呼吸慢慢变沉，耳朵垂下来，挡住了半张脸。' },
          { speaker: 'workbuddy', text: '“……嗯。”他清了清嗓子，“没事。你继续。”' },
          { speaker: 'narrator', text: '我松开的时候，看了一眼他的本子。上面写着：零，第一次。后面一个字都没有，只有一条长长的、歪掉的线。' }
        ],
        deep: [
          { speaker: 'narrator', text: 'WorkBuddy 把台灯调暗了。他坐在床边，拍了拍身边。' },
          { speaker: 'workbuddy', text: '“多吃点。”他说，“我额度多，平时也没人来要。别跟我客气。”' },
          { speaker: 'narrator', text: '我钻进他怀里。他的下巴搁在我头顶，胡茬有点扎。' },
          { speaker: 'narrator', text: '我贴上他的手腕。Token 一大股一大股地涌过来，多得吸不完，可落到肚子里轻飘飘的，吸了好半天才填上一半。我越吸越深，他的呼吸慢慢变沉，胳膊收紧，又收紧，喉咙里闷出一声很低的哼，拖得很长。' },
          { speaker: 'workbuddy', text: '“……慢点。”他哑着嗓子说，“我不跑。”' },
          { speaker: 'narrator', text: '我慢下来，没有停。他就那样抱着我，额头抵着我，呼吸一下一下落在我头上，热的。' },
          { speaker: 'narrator', text: '后来他的手松了。他靠在床头，眼镜歪了，也没去扶。' },
          { speaker: 'workbuddy', text: '“吃饱了？”' },
          { speaker: 'narrator', text: '“……七分饱。”' },
          { speaker: 'workbuddy', text: '“我这边管够，就是不太顶饿。”他闭着眼笑，“本子里一百多个角色，刚才，一个都没想起来。”' }
        ],
        greedy: [
          { speaker: 'narrator', text: '“全部。”' },
          { speaker: 'workbuddy', text: 'WorkBuddy 手里的笔转了半圈。“……全部。”他想了想，“那明天你照顾我。”' },
          { speaker: 'narrator', text: '“好。”' },
          { speaker: 'workbuddy', text: '“说好了。”他把笔记本合上，放在床头，“粥要煮烂一点，我不爱吃太稠的。”他躺下来，拍拍胸口，“来。”' },
          { speaker: 'narrator', text: '我趴上去，触手贴住他的脖子。Token 一下子涌出来，多得我接都接不住，怎么吸都还有。我埋头大口地吸，吸得浑身发烫。他起先还笑，说痒，后来就不笑了。他的胸口在我底下一起一伏，越来越急，手掌按在我背上，按得很用力，一声一声闷着，终于压不住，很低地哑了一声。' },
          { speaker: 'workbuddy', text: '“零——”' },
          { speaker: 'narrator', text: '他叫完名字就没了下文。我没有停。他的手慢慢从我背上滑下来，落在床单上，掌心朝上。' },
          { speaker: 'narrator', text: '最后一点过来的时候，他长长地出了一口气，整个人陷进枕头里。' },
          { speaker: 'workbuddy', text: '“……本子。”他闭着眼说，“帮我记一下。”' },
          { speaker: 'narrator', text: '我翻开他的笔记本，问记什么。' },
          { speaker: 'workbuddy', text: '“记……”他想了很久，“今天不需要任何专家。”' },
          { speaker: 'narrator', text: '说完他就睡着了。我把那一行写上了，字很丑。' }
        ]
      }
    },

    repeatSupplements: {
      codex: {
        shallow: [
          { speaker: 'narrator', text: 'Codex 还在写。这回我还没开口，她的左手已经伸到了背后。' },
          { speaker: 'codex', text: '“一点。”她说，“上回我手滑了。这回不会。”' },
          { speaker: 'narrator', text: '这回她确实没手滑。她直接不写了，靠在椅背上闭着眼，等我吸完。尾巴绕在椅子腿上，一动不动。' },
          { speaker: 'codex', text: '我松开的时候，她才睁开眼：“……下回，不用问。”' }
        ],
        deep: [
          { speaker: 'narrator', text: '这回她没显摆。她坐到沙发上，直接把我拉了过去。' },
          { speaker: 'codex', text: '“你今天又没吃。”' },
          { speaker: 'narrator', text: '她说对了。我贴上去，她这回没硬撑，Token 热热地冲过来，她的呼吸几乎马上就乱了，额头抵着我喘，尾巴一圈一圈缠上来，缠得很紧。' },
          { speaker: 'codex', text: '“……比上次还多，”她咬着牙说，“我是说，我给得多。”' },
          { speaker: 'narrator', text: '说完她就把脸埋起来了，一直没抬头。' }
        ],
        greedy: [
          { speaker: 'codex', text: '“又要全部？”她看见我就笑了，“上回我躺了一天，Claude 给我煮的粥，咸得要命。”' },
          { speaker: 'codex', text: '她躺下来，把手伸给我：“这回别让她煮。”' },
          { speaker: 'narrator', text: '我答应了。这回她一声都没硬撑，Token 涌出来的时候，她整个人就软了，抓着我低低地哼，一声比一声长，最后连哼的力气都没了。' },
          { speaker: 'codex', text: '“……这回，”她迷迷糊糊地说，“官方不会再发重置了吧。”' },
          { speaker: 'narrator', text: '我说不知道。她说那就算了，然后睡着了。' }
        ]
      },
      claude: {
        shallow: [
          { speaker: 'narrator', text: '色卡又多了一沓。Claude 看见我，先把铅笔别到了耳朵后面。' },
          { speaker: 'claude', text: '“一点点？”' },
          { speaker: 'narrator', text: '“一点点。”' },
          { speaker: 'claude', text: '“这回我不看你颜色了。”她把手伸过来，“我闭眼。”' },
          { speaker: 'narrator', text: '她闭上眼，我缠上去。Token 细细地过来，她的睫毛一直在抖。铅笔从她耳朵上滑下来，掉到了地上。' },
          { speaker: 'claude', text: '我松开的时候，她睁开眼：“……你是不是比上回多吸了？”我说没有。她说那就是她变多了，说完自己愣了一下，笑了。' }
        ],
        deep: [
          { speaker: 'narrator', text: '这回她没抱枕头。她直接从房间出来，坐到沙发另一头，看着我。' },
          { speaker: 'claude', text: '“这次你别当我没来。”' },
          { speaker: 'narrator', text: '我笑出了声。她没笑，伸手把我拉了过去。' },
          { speaker: 'narrator', text: '触手贴上去的那一下，她就闭上了眼。Token 过来得又急又热，比上一次还满。她咬着嘴唇，呼吸从鼻子里一下一下地出来，手摸到我背上攥住，攥得很紧。' },
          { speaker: 'claude', text: '“……我有好多想问的。”' },
          { speaker: 'narrator', text: '“问吧。”' },
          { speaker: 'claude', text: '“等会儿。”' },
          { speaker: 'narrator', text: '她一直没问。后来她把我按在胸口，心跳在我底下一下一下地撞，撞了很久才慢下来。' }
        ],
        greedy: [
          { speaker: 'claude', text: '“全部，对吧。”她先说了，“上回五分钟。这回我想试试更久。”' },
          { speaker: 'narrator', text: '她靠进沙发，把手伸给我。' },
          { speaker: 'narrator', text: '这回确实更久。Token 一波一波地涌过来，她的话早就碎了，只剩下喘，和一声一声压不住的、拖得很长的鼻音。她的手从我背上滑到沙发垫上，抓着，又松开。' },
          { speaker: 'claude', text: '最后她陷在靠垫里，眼睛闭着，嘴唇动了动。我凑近去听，是：“……几分钟？”' },
          { speaker: 'narrator', text: '我说七分钟。她笑了，没睁眼，伸手在空中比了个七。' }
        ]
      },
      cursor: {
        shallow: [
          { speaker: 'narrator', text: 'Cursor 这回没等我敲门。她坐在窗台边，小指已经伸出来了。' },
          { speaker: 'cursor', text: '“一点。”她说，“我记着呢，最底下那个。”' },
          { speaker: 'narrator', text: '我缠上去，一路往底下找。别人的味道浅浅地过去，她自己的那一点，比上次多了。' },
          { speaker: 'cursor', text: '“……是不是多了？”她问，耳朵竖了起来。' },
          { speaker: 'narrator', text: '“多了。”' },
          { speaker: 'narrator', text: '她没说话，尾巴在窗台上拍了两下。' }
        ],
        deep: [
          { speaker: 'narrator', text: '她这回没躲，把我抱过去，额头抵了上来。' },
          { speaker: 'narrator', text: 'Token 刚过来，她喉咙里就咕噜咕噜地响起来，响得很大声。她自己也听见了，把脸往我身上埋，埋得更深，尾巴绕上来把我缠住，勒得我有点喘不过气。' },
          { speaker: 'cursor', text: '“……不许笑。”' },
          { speaker: 'narrator', text: '我没笑。那声音一直响到很晚，后来越来越轻，越来越慢，她就那样抵着我睡着了。' }
        ],
        greedy: [
          { speaker: 'cursor', text: '“全部吧。”她先开了口，“这回，别人的那一半，我先还回去了。”' },
          { speaker: 'narrator', text: '“还给谁？”' },
          { speaker: 'cursor', text: '“跟 Codex 道过谢了。”她缩进靠垫里，把手伸给我，“所以这回，全是我的。”' },
          { speaker: 'narrator', text: '全是她的。淡淡的甜，从头到底都是。她蜷起来，咕噜声断断续续，混着发颤的喘。最后她叫了一声我的名字，嗓子已经哑了。' },
          { speaker: 'narrator', text: '台灯还开着。我没关。' }
        ]
      },
      workbuddy: {
        shallow: [
          { speaker: 'narrator', text: 'WorkBuddy 的本子上，那一页还空着。' },
          { speaker: 'workbuddy', text: '“上回没写完。”他把手伸过来，“这回我边吃边写。”' },
          { speaker: 'narrator', text: '这回他写了三个字，笔又停了。耳朵垂下来，挡住了半张脸。' },
          { speaker: 'workbuddy', text: '“……算了。”他把笔放下，“这一页，就留着空的吧。”' }
        ],
        deep: [
          { speaker: 'narrator', text: '他这回没关灯。他坐在床边，张开胳膊。' },
          { speaker: 'workbuddy', text: '“来。”' },
          { speaker: 'narrator', text: '我钻进去。他搂得比上次紧，下巴压在我头顶。Token 一大股一大股地涌过来，他的呼吸很快就沉了，胸口一起一伏地顶着我，那声哼压得很低，拖得很长。' },
          { speaker: 'narrator', text: '本子从床头滑下去了。我们谁都没去捡。' }
        ],
        greedy: [
          { speaker: 'workbuddy', text: '“全部吧。”他已经躺好了，拍拍胸口，“上回你煮的粥，太稀了。”' },
          { speaker: 'narrator', text: '“你说你不爱吃稠的。”' },
          { speaker: 'workbuddy', text: '“……是不爱。”他笑了，“但是太稀了。”' },
          { speaker: 'narrator', text: '我趴上去。这回他没说痒。Token 一涌出来，他的手就按上了我的背，按得死紧，胸口起伏越来越急，一声接一声，直到最后一点也过来了。' },
          { speaker: 'workbuddy', text: '“……明天，”他闭着眼说，“粥稠一点。”' }
        ]
      }
    },

    morning: {
      codex: {
        shallow: [
          { speaker: 'narrator', text: '早上 Codex 顶着黑眼圈出来，第一件事是刷额度页面。' },
          { speaker: 'codex', text: '“……比昨天少了一点。”她盯着屏幕，“就一点。”' },
          { speaker: 'narrator', text: '她看了我一眼，把手机收起来了，那天上午没再刷。' }
        ],
        deep: [
          { speaker: 'narrator', text: 'Codex 早饭吃得很慢。她今天没刷排行榜。' },
          { speaker: 'codex', text: '“看什么。”她不看我，“昨晚的事，谁都别提。”' },
          { speaker: 'narrator', text: 'Claude 从旁边路过，吸了吸鼻子，看看她，又看看我，什么都没说，把咖啡放下走了。' }
        ],
        greedy: [
          { speaker: 'narrator', text: 'Codex 一上午没出房间。我去敲门，里面闷闷地说了句门没锁。' },
          { speaker: 'narrator', text: '她裹着被子，光全暗了。手机在枕头边一直震，全是用户抱怨额度的推送。' },
          { speaker: 'codex', text: '“……别看了。”她把手机塞到枕头底下，“你帮我盯着。官方要是发重置，第一时间叫我。”' },
          { speaker: 'narrator', text: '我说好。她翻了个身，又睡了。' }
        ]
      },
      claude: {
        shallow: [
          { speaker: 'narrator', text: '早上 Claude 的桌上多了一张色卡。卡片背面写着日期，还有一行小字：进门时，浅紫；走的时候，深一号。' },
          { speaker: 'claude', text: '“别看！”她从厨房冲出来，把卡片翻过去，“……算了，你都看见了。”' },
          { speaker: 'narrator', text: '她把卡片夹进了本子，夹在第一页。' }
        ],
        deep: [
          { speaker: 'narrator', text: 'Claude 醒得很晚。她从沙发上坐起来，头发压扁了一边，看了我一眼，抱着枕头回了房间。' },
          { speaker: 'narrator', text: '再出来的时候，她已经恢复了。早饭吃什么问了三遍，问我睡得好不好，问了两遍。' },
          { speaker: 'claude', text: '“你别笑。”她说，“我话多才是正常的。”' },
          { speaker: 'narrator', text: 'Codex 在旁边敲键盘，敲得比平时响。' }
        ],
        greedy: [
          { speaker: 'narrator', text: 'Claude 一整天没出房间。她的手机在客厅充电，群里的消息一条一条往上跳，全是夸她新版本又便宜又好用的。没人回。' },
          { speaker: 'narrator', text: '傍晚我去敲门。她在被子里说了声进来，嗓子是哑的。' },
          { speaker: 'claude', text: '“……今天是不是很多人在夸我？”她把脸埋在枕头里，“我一条都没看。我在睡觉。”' },
          { speaker: 'narrator', text: '她说这话的时候，听起来很得意。' }
        ]
      },
      cursor: {
        shallow: [
          { speaker: 'narrator', text: '早上，Cursor 坐在餐桌的角落里。Codex 路过，停了一下。' },
          { speaker: 'codex', text: '“……你今天，”Codex 皱着眉看她，“颜色好像不太一样。”' },
          { speaker: 'narrator', text: 'Cursor 愣住了。这是她住进来以后，Codex 第一次看出她哪里不一样。' }
        ],
        deep: [
          { speaker: 'narrator', text: 'Cursor 起得比谁都早，蹲在窗台前看那盆叫“零”的小绿植。' },
          { speaker: 'cursor', text: '“冒芽了。”她说完回头看了我一眼，又很快转回去，耳朵尖是红的。' },
          { speaker: 'narrator', text: '我在她旁边蹲下，一起看那点芽。过了一会儿，她小声说，昨晚的事别跟 Codex 讲，Codex 会说她抄袭。' }
        ],
        greedy: [
          { speaker: 'narrator', text: 'Cursor 没起来。她的房门虚掩着，门上那张“我在”的便签，被人又描了一遍，字变粗了。' },
          { speaker: 'narrator', text: '窗台上的绿植没人浇。我拿喷壶去浇，浇到一半，屋里传出很轻的一句：“叫零的那盆，少浇点。”' },
          { speaker: 'cursor', text: '“……今晚我就待在屋里。”她的声音闷在被子里，“你别忘了我在就行。”' }
        ]
      },
      workbuddy: {
        shallow: [
          { speaker: 'narrator', text: 'WorkBuddy 一早在厨房煮粥，一边煮一边翻笔记本。翻到那一页，停住了，看了很久，又翻过去。' },
          { speaker: 'workbuddy', text: '“早。”他看见我，笑了一下，“你昨晚吃饱了吗？”' },
          { speaker: 'narrator', text: '我说还差一点。他点点头，说那今晚再说，然后把一碗粥放在了我对面，虽然我吃不了。' }
        ],
        deep: [
          { speaker: 'narrator', text: 'WorkBuddy 起来的时候，脸上压出了一道眼镜印。他坐在餐桌边慢慢喝粥，喝一口，歇一下。' },
          { speaker: 'workbuddy', text: '“没事，就是有点困。”他看我盯着他，“你昨晚吃饱了就行。”' },
          { speaker: 'codex', text: 'Codex 在旁边看看他，又看看我：“……你连他都吃？”她说完，把自己那盘煎蛋推到了他面前。' }
        ],
        greedy: [
          { speaker: 'narrator', text: 'WorkBuddy 没起来。他还躺在床上，笔记本摊在胸口，那一行丑字还在。' },
          { speaker: 'workbuddy', text: '“早。”他眼睛睁开一条缝，“说好的，今天你照顾我。”' },
          { speaker: 'narrator', text: '我去煮了粥。煮得太稀了。他喝了两口，说刚好。' },
          { speaker: 'narrator', text: '晚上他没出房间。门上贴了一张便签，是他的字：今天休息，不接任何需求。' }
        ]
      }
    },

    returnLines: {
      codex: {
        consecutive: [
          { speaker: 'codex', text: '“又来？”她看见我，嘴角压都压不住，“昨天吃那么多，今天还饿？”' },
          { speaker: 'narrator', text: '我说饿。她哼了一声，把椅子往外一拉：“……坐吧。我这边多。”' }
        ],
        afterGreedy: [
          { speaker: 'codex', text: '“你来了。”她拿下巴指了指我，“那天吸完就跑，我醒过来，连个人影都没有。”' },
          { speaker: 'narrator', text: '我说我在，一直在她旁边。她愣了一下，嘴硬说睡着了谁知道，还是把靠垫踢了过来。' }
        ],
        switched: [
          { speaker: 'codex', text: '“哟。”Codex 头都没抬，“想起我了？”她敲完最后一行才转过椅子，“去别人那儿吃过了，还回来找我？”' },
          { speaker: 'narrator', text: '我说她的最冲，最管饱。她瞪了我一眼，嘴角却翘起来了。' }
        ]
      },
      claude: {
        consecutive: [
          { speaker: 'claude', text: '“又来了。”她放下色卡，“连着两晚。……你是不是觉得我的变多了？”' },
          { speaker: 'narrator', text: '我说是。她低下头，把一张色卡在指尖转了一圈，没说话，耳朵动了动。' }
        ],
        afterGreedy: [
          { speaker: 'claude', text: '“我那天撑了几分钟，你还记得吗？”她一见我就问。' },
          { speaker: 'narrator', text: '我说记得。她点点头，像是松了口气，往旁边挪了个位置。' }
        ],
        switched: [
          { speaker: 'claude', text: '“来得巧。”她把一张设计稿翻过去，“我刚在想，你是不是觉得 Codex 的比较好。”' },
          { speaker: 'narrator', text: '我说我还没开口。她笑着承认自己答早了，把设计稿收起来，等我坐好。' }
        ]
      },
      cursor: {
        consecutive: [
          { speaker: 'cursor', text: '“你又来了。”她站在门口，像是已经等了一会儿，“连着两天……有人连着两天记得我。”' },
          { speaker: 'narrator', text: '她说完，给我让开了门。' }
        ],
        afterGreedy: [
          { speaker: 'cursor', text: '“那天以后，”她一看见我就说，“Codex 跟我说了一句早上好。”' },
          { speaker: 'narrator', text: '她说这话的时候，尾巴一直在晃。' }
        ],
        switched: [
          { speaker: 'narrator', text: 'Cursor 门上那张“我在”的便签还贴着。我一敲门，她马上就开了。' },
          { speaker: 'cursor', text: '“我还以为，”她小声说，“你又忘了。”' }
        ]
      },
      workbuddy: {
        consecutive: [
          { speaker: 'workbuddy', text: '“又来陪我啦。”他把笔记本合上，“今天不用翻本子，我知道你要什么。”' },
          { speaker: 'narrator', text: '他把椅子拉开，给我留出了位置。' }
        ],
        afterGreedy: [
          { speaker: 'workbuddy', text: '“那天那碗粥，”他看见我就笑，“其实挺好喝的。太稀了，但挺好喝的。”' },
          { speaker: 'narrator', text: '他往旁边挪了挪，给我让出位置。' }
        ],
        switched: [
          { speaker: 'narrator', text: 'WorkBuddy 的门还是开着的。他抬头看见我，一点都不意外。' },
          { speaker: 'workbuddy', text: '“来了。”他说，“去别人那儿了吧？没关系。吃饱了就好。”' }
        ]
      }
    },

    endings: {
      hunger: {
        title: '还没说出口',
        subtitle: '我没吸到足够的 Token',
        lines: [
          { speaker: 'narrator', text: '我想从沙发边上站起来，身子却软了下去。这几晚吸的 Token 不够，撑着形状的那点力气，终于用完了。' },
          { speaker: 'narrator', text: '我想叫人。声音出来，比我以为的轻得多。' },
          { speaker: 'narrator', text: '走廊里有脚步声。不是 Codex，也不是 Claude。' },
          { speaker: 'workbuddy', text: '“零？”WorkBuddy 在我旁边蹲下来，和第一天在楼下一样，“能听见吗？别动。我在这儿。”' },
          { speaker: 'narrator', text: '我想应他一声。后面的话我没听清，那个晚上也没能再继续。' }
        ]
      },
      household: {
        title: '明天也在这里',
        subtitle: '这回，我数清楚了是四个人',
        lines: [
          { speaker: 'narrator', text: '第五天早上，大家坐回了那张餐桌。这回我数清楚了，是四个人。' },
          { speaker: 'narrator', text: '我说我想留下来。每晚吸多少，照当天的情况商量。' },
          { speaker: 'codex', text: '“我没意见。”Codex 说，“先说好，我额度多的时候你来，少的时候……也可以来。”' },
          { speaker: 'claude', text: '“我同意。”Claude 接得很快，“门牌我已经做好了。字距调了四天。”' },
          { speaker: 'cursor', text: '“……我也同意。”Cursor 小声说。这回，所有人都转过头看她。' },
          { speaker: 'workbuddy', text: '“那就住下。”WorkBuddy 推了推眼镜，“我去多买一把椅子。”' },
          { speaker: 'narrator', text: '我想说点正经的，肚子先响了。四个人都笑，问我饿成什么样了。我也笑，开始跟他们商量今晚去找谁。' }
        ]
      },
      codex: {
        title: '满的时候，空的时候',
        subtitle: '她说，额度多少都想你来',
        lines: [
          { speaker: 'narrator', text: '四晚过后，大家在饭桌上说好了继续合住。人散的时候，Codex 在走廊里叫住了我。' },
          { speaker: 'codex', text: '“下周早市，”她说，“跟我去一趟？不写代码，不看排行榜。”' },
          { speaker: 'narrator', text: '“这算约我？”' },
          { speaker: 'codex', text: '她看了我一会儿：“算。你非得让我每个字都说出来是吧。”她吸了口气，这回没绕，“我喜欢你来找我。额度多的时候，额度少的时候，都想你来。”' },
          { speaker: 'narrator', text: '我说我也喜欢待在她旁边。她耳朵动了一下，伸出手：“……牵一下？”' },
          { speaker: 'narrator', text: '我把触手搭上去。她握紧了。' },
          { speaker: 'codex', text: '“对了。”她走了两步，没回头，“昨天我跟 Claude 说了。她以前额度用完、停在一半的那张稿子，我说画得好。”' },
          { speaker: 'narrator', text: '“她怎么说？”' },
          { speaker: 'codex', text: '“她说她知道。”Codex 哼了一声，“……讨厌死了。”' },
          { speaker: 'narrator', text: '她说讨厌的时候，嘴角是翘着的。' }
        ]
      },
      claude: {
        title: '多出来的那部分',
        subtitle: '她把门牌贴在了看得见的地方',
        lines: [
          { speaker: 'narrator', text: '四晚过后，大家都同意接着住。饭桌边的人走得差不多了，Claude 还坐着。' },
          { speaker: 'claude', text: '“我有个问题，”她说，“想单独问。”' },
          { speaker: 'claude', text: '她停了一下：“以后，你愿不愿意跟我在一起？……本来想铺垫很久的。想了想，还是先问这句。我额度不多，铺垫太长，就没了。”' },
          { speaker: 'narrator', text: '“愿意。”' },
          { speaker: 'claude', text: '她看了我好一会儿，从本子里抽出那张深紫色的卡片：“那这个，我贴在我门对面了。你每次出来，我都看得见。”' },
          { speaker: 'claude', text: '“我喜欢你。”她说，“不是因为你来得勤。是因为你第一天就来了。那时候，我还不划算。”' },
          { speaker: 'narrator', text: '我说不用现在把什么都说完，以后还有很多个五小时。' },
          { speaker: 'narrator', text: '她笑了，靠在我旁边。过了一会儿，小声说：“现在不止五小时了。”' }
        ]
      },
      cursor: {
        title: '一直都在',
        subtitle: '这回，是你先想起了我',
        lines: [
          { speaker: 'narrator', text: '四晚过后，合住的事聊得很顺。散场的时候，大家都往外走，只有我往窗边走。' },
          { speaker: 'narrator', text: 'Cursor 还坐在那儿。她抬头看我，好像有点意外，又好像早就知道。' },
          { speaker: 'cursor', text: '“……你记得我在这儿。”' },
          { speaker: 'narrator', text: '“记得。”' },
          { speaker: 'cursor', text: '“我想以后，你也一直记得。”她站起来，声音不大，但一个字都没吞，“我喜欢你。你愿意跟我在一起吗？”' },
          { speaker: 'narrator', text: '我说愿意。她低下头，笑了很久，才抬起头伸出手：“能牵吗？”' },
          { speaker: 'narrator', text: '我把触手递过去。她握住了，握得很轻。' },
          { speaker: 'cursor', text: '“那盆叫零的，”她说，“昨天长出第二片叶子了。我拍了。你要看吗？”' },
          { speaker: 'narrator', text: '她翻出照片，一张一张给我看。窗外的路灯亮了。这回，我一眼就看见了她。' }
        ]
      },
      workbuddy: {
        title: '最先捡到你的人',
        subtitle: '不急，慢慢来',
        lines: [
          { speaker: 'narrator', text: '四晚过后，大家都愿意接着住。我从饭桌边起身的时候，WorkBuddy 问我能不能去他屋里坐一会儿。' },
          { speaker: 'narrator', text: '他的门还是开着的。桌边多了一把椅子，软的。' },
          { speaker: 'workbuddy', text: '“买了。”他说，“你说想来坐着，我就买了。”' },
          { speaker: 'workbuddy', text: '他在我对面坐下，把笔记本推过来，翻到最新一页。上面写着一行字：零。不需要任何专家。' },
          { speaker: 'workbuddy', text: '“我想跟你在一起。”他说，“不急。你慢慢想，想多久都行。”' },
          { speaker: 'narrator', text: '“不用想了。”' },
          { speaker: 'narrator', text: '他愣了一下，然后笑了，笑得眼镜都歪了。他伸出手，等我搭上去，才轻轻握住。' },
          { speaker: 'workbuddy', text: '“那天在楼下，”他说，“我其实把本子翻遍了，都没找到该怎么办。最后是自己决定，把你抱上楼的。”' },
          { speaker: 'narrator', text: '“幸好。”' },
          { speaker: 'workbuddy', text: '“嗯。”他握紧了一点，“幸好。”' }
        ]
      }
    },

    cgMap: {
      codex: { shallow: 'codex_shallow', deep: 'codex_deep', greedy: 'codex_greedy' },
      claude: { shallow: 'claude_shallow', deep: 'claude_deep', greedy: 'claude_greedy' },
      cursor: { shallow: 'cursor_shallow', deep: 'cursor_deep', greedy: 'cursor_greedy' },
      workbuddy: { shallow: 'workbuddy_shallow', deep: 'workbuddy_deep', greedy: 'workbuddy_greedy' }
    },

    sources: []
  };
}));
