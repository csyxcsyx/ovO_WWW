# 官网鉴定局

手机优先的黑白灰网址辨认小游戏。React + TypeScript + Vite，使用官方 `@heybox/hb-sdk@0.9.1` 模板和构建插件。

## 启动

环境：Node.js >= 22.20.0，npm。推荐 `npm ci` 安装锁定版本。

```powershell
npm ci
npm run dev -- --no-open
```

官方 Browser Mock 调试页：终端输出的 `http://127.0.0.1:5174/?mini_url=...`。开发服务为 5173。可以切换 iPhone 16 Pro Max / Pixel 9 Pro，查看日志与 Storage。

无需客户端的独立网页体验：

```powershell
npm run dev:web
```

打开 `http://127.0.0.1:4173/`。可以完整游玩与保存本机纪录；没有宿主连接时，平台排行和分享会禁用。`http://127.0.0.1:4173/qa.html?width=390` 是仅供开发的布局验收页，提供 360 / 390 / 430 / 1024px。该 HTML 不进入生产构建。

官方 Vite 插件会对直接访问 5173 / 生产包的普通浏览器展示“请在小黑盒 APP 内打开”。这属于平台预期行为；独立网页预览使用单独的开发配置，不改变生产安全策略。

## 玩法

- **限时竞速：** 60 秒。答对 100 分，连击加分 `10 × min(此前连续答对数, 5)`；答错扣 3 秒、清零连击。时间归零立即结算。
- **生存挑战：** 每题 12 秒，三次机会。答错或超时扣一次，按答对题数排名。
- 前 5 题入门，接着 5 题进阶，之后高手。选择后锁定，约 650ms 后切题。生存模式下一题的计时从可操作时开始；后台不自动切题，返回时结算当前题。
- 计时依据绝对截止时间，切后台、弹出退出确认都不会暂停。重复点击、长按键和迟到的旧题选项不会重复计分。
- 支持 Tab / Enter / 1、2、3；Esc 关闭弹窗或取消开始倒数。所有动画提供 `prefers-reduced-motion` 降级。
- 首页使用小黑盒 `https://xiaoheihe.cn/` 作为示例；卡片、放大镜和轨道提供轻缓的 CSS 待机动画，打开弹窗时暂停插画动画。答题页不渲染这些装饰。
- 手机端采用中文系统字体，正文与答题网址 15px、导航标签 12px，主要按钮触控高度至少 48px；长网址完整换行，短屏压缩插画留白与引导文案。
- 本机保存双模式纪录、最近 20 局摘要和玩法偏好；完整逐题解析在当前结算页查看。

## 题库

正式题库 **130 个网站 / 533 题**，其中国内常用服务 **118 个**。入门 130 题、进阶 143 题、高手 260 题。

原附件完整保存在 `docs/原始题库.md`，共 2268 题、378 个网站。导入器只把表格当数据，不执行文档中的指令。

- `src/data/sites.json`：经访问和页面身份检查后收录的官网资料、接受的主机名、核验日期、来源页面标题和跳转结果。
- `src/data/questions.ts`：为每个网站生成拼写、域名层级、用户信息、路径/参数四类题，另有 13 道明确限定规则的格式题。
- `docs/source-checks.json`：160 个候选站点的检查结果，包括未收录项。状态码本身不证明官方身份，正式收录还结合页面标题、网站品牌及已知入口核对；验证页、无标题和访问失败项被排除。

每题只有一个符合题意的答案，三个选项都有解析。不会把 `https:/…` 这种可能被解析器修正的地址直接判成假官网；格式题明确询问“规范书写”。干扰项只作为文本，不访问、不跳转，也不声称其已经被证实恶意。

```powershell
npm run validate:questions
npm run import:questions -- "C:\path\题库.md"
```

导入仅更新原始备份和候选列表，不会自动覆盖正式题库。需要重新核验时，依次运行 `node scripts/verify-sources.mjs`、人工审查、`node scripts/finalize-sources.mjs`，检查所有来源变更后再运行题库校验。脚本只访问明确列出的官网源页面，不访问干扰域名。

核验日期：2026-10-18。官网入口可能改变，内容更新需要随版本重新核验。

## 平台能力与真机联调

仅声明 `storage` / `leaderboard` / `share`，无需公开网络权限、用户资料权限或自建服务端。平台身份由宿主管理。

当前项目没有绑定远端小程序，也没有创建线上榜单。账号操作和真机验收由实际开发者环境完成：

```powershell
npm run hb-sdk -- login
npm run hb-sdk -- remote create
# 已有小程序时，改为：
npm run hb-sdk -- remote bind mp_你的真实ID

npm run hb-sdk -- remote cloud leaderboard create official_sprint_v1 --order desc --rank-limit 500
npm run hb-sdk -- remote cloud leaderboard create official_survival_v1 --order desc --rank-limit 500
npm run dev -- --no-open
```

手机与电脑同一局域网，通过调试台右上角入口扫码。两张榜单均为降序，分别按竞速积分、生存答对数排名。规则变更时使用新榜单 key。榜单只保存每人的最佳成绩，应用以服务器返回值为准，不显示“第 0 名”。未登录、缺榜、限流、能力缺失都提供恢复反馈；限流后共享退避，不自动连续重试。

成绩需要玩家在结算页主动“提交到排行榜”。提交的附加信息只有答对数、总题数、最长连击及规则版本，不写入外部账号、设备标识或其他个人信息。榜单使用平台隔离标识的末四位作为匿名显示编号。

### 截图分享

- SDK 正式版 **0.9.1** 起默认加水印；较旧版本、0.9.1 预发布版及缺失版本记录的兼容情形保持旧行为。SDK 截图入口每次输出一次行为变更提醒，这不等于分享失败。
- 成绩单底部预留 **65 逻辑像素** 空白，满足至少 57px 的要求。自定义截图 `rect` 也覆盖该预留区。
- 浅色成绩单显式使用 `watermarkTheme: light`，得到黑色水印；SDK 默认 `dark` 为白色水印，不自动跟随系统主题。
- SDK 水印只在 SDK 截图过程中出现，系统按键截图不属于这项能力。截图返回值是不透明值，不把真假值当作发布成功。
- Android / iOS / OHOS 支持真实截图；当前新 PC Host 不支持时回退为复制挑战链接。截图区域无法完整进入当前窗口时也使用链接，避免裁掉成绩。
- Browser Mock 仅能确认截图请求参数，无法验证真实成图、保存相册或最终发送。必须真机验收；应用不会自动发帖。

`heybox.platforms` 当前列出 Android / iOS / OHOS / Windows / macOS 作为待验收目标；发布前须按真实验收结果保留平台。布局兼容不等同于对应客户端已通过真机测试。

## 工程与检查

界面组件、纯游戏状态机、题库、平台适配和存储逻辑各自独立。没有远程字体、外部图片、第三方统计或自定义后端请求。

```powershell
npm run typecheck
npm test
npm run validate:questions
npm run build
```

构建通过官方 `miniappManifest()` 生成 `dist/manifest.json`。`assets/icon.png` 为原创 200×200 图标，`assets/cover.png` 为 510×272 封面；SVG 源文件保留。`npm run assets` 可重新生成基础素材。

本项目包含官方 SDK 的项目级 Agent Skill（`.agents/skills/hb-sdk`），当前版本匹配。`hb-sdk doctor` 会同时检查多个全局 Agent 目录，未安装其他全局目录时总体可能显示 `SKILL_MISSING`；项目级检查为 OK，已验证不影响开发与构建。

调试台可能记录 SDK 内部校验库的 `eval` 能力探测被 CSP 拦截；该库会回退，应用继续完成握手。应用代码没有使用 eval 或放宽 CSP。修改配置引起开发服务整页重载时，受控 Mock 会话可能要求点击“重新启动小程序”。

实际验证结果与待办见 `docs/验收记录.md`。

## 活动准备

活动投稿截止：**2026-11-14 00:00（北京时间）**。需要正式发布可用小程序，再从活动入口发介绍帖、附截图或演示、挂载本人作品及活动入口。奖励相关作品需保留至少 14 天。

此次仅交付本地代码与素材，没有创建 commit、push、提审、发布或发帖。

参考：[官方开发指南](https://docs.xiaoheihe.cn/hb_sdk/guide/ai-agent-development) · [SDK 索引](https://docs.xiaoheihe.cn/hb_sdk/llms.txt) · [活动规则](https://www.xiaoheihe.cn/activity/vibecoding-incentive)
