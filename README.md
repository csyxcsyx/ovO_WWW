# 官网鉴定局

从三个网址中找出真正的官网入口。一个在小黑盒小程序工坊运行的网址辨认游戏，包含 130 个网站、533 道题目。

## 玩法

- **限时竞速**：60 秒内尽可能多答对，答对得分、连击加分，答错扣 3 秒。
- **生存挑战**：每题 12 秒、三次机会，按答对题数排名。
- 难度逐步提升，赛后可查看逐题解析、本机纪录和云端排行，新纪录自动同步，支持成绩分享。

网址选项仅作为文本展示，不跳转。支持触屏与键盘操作：`1` / `2` / `3` 作答，`Tab` / `Enter` 导航。

## 本地运行

使用 Node.js ≥ 22.20.0 和 npm：

```powershell
npm ci
npm run dev -- --no-open
```

打开终端输出的官方 Browser Mock 调试页。榜单和分享等能力需在小黑盒中联调。

也可运行 `npm run dev:web`，在 `http://127.0.0.1:4173/` 体验离线答题和本机纪录。

## 开发

React + TypeScript + Vite，使用官方 `@heybox/hb-sdk` 接入平台能力，无自建服务器。

- `src/components`：界面组件。
- `src/game`：抽题、计时与计分。
- `src/platform`：平台适配、纪录与榜单同步。
- `src/data`：网站资料与题库。
- `scripts` / `assets`：数据维护与发布素材。

```powershell
npm run typecheck
npm test
npm run validate:questions
npm run build
```

核心回归测试与代码放在同一目录。构建产物位于 `dist/`，本地生成文件位于 `output/`，均不入库。

开发、真机联调、权限和提审流程见 [小黑盒开发发布指南](docs/小黑盒开发发布指南.md)。原始题库及来源核验资料保留在 `docs/`，数据变更需重新核验。
