# 版本留存

## v0.2.1 手机与商店探索版（2026-10-11）

- 更新原公开免登录站点：[装游戏模拟器](https://install-game-simulator.feywasp4.chatgpt.site)。Sites 原访问设置回读为 `public`，本次保持不变。
- 游戏源码提交：`f6fdf8941600d4f4b4c7c03b4e4d834a61024bc7`，包括此前手机适配提交 `7e1c0f1`；未推送 GitHub，也未改动经典版。
- 手机单窗口、底部导航、滚动桌面网格、两列商店和固定详情操作区；电脑桌面布局与存档保持兼容。
- 移除“梗游戏专区”，新存档先揭晓两款，按首次安装不同游戏的收藏数逐批揭晓全部 32 款。未知卡片隐藏名称与封面；已有存档的既有游戏仍可使用。
- 73 项测试、类型检查、数值模拟、生产构建通过；Chrome 手机模拟三档与桌面两档完成浏览器验收。具体操作与未测平台见 `validation.md`。
- Site ID：`appgprj_6ac926a0d608819187bb50773515c918`。
- 独立站点发布源码提交：`62bbb9333331395150a6655117ed0180c900f2d6`。
- Saved version ID：`appgprj_6ac926a0d608819187bb50773515c918~appgver_14c6485343e081919e871743449d4ce9`。
- Deployment ID：`appgdep_6acb3846258c8191a54efa2eacd63f51`，原生工具返回 `succeeded`。
- 构建快照：`artifacts/releases/v0.2.1/site/dist/`；发布包：`artifacts/releases/v0.2.1/site-v0.2.1.tar`。归档 SHA256：`7c5775a168f984e88754872b2a75566ee28eb2b5e40c5d7681a678f51e54276f`。
- 无 Cookie、Authorization 或访问绕过令牌的请求：首页及本版 JS/CSS/Three.js 均 HTTP 200，无登录跳转；三个脚本/样式内容哈希均与本地一致。线上首页含 Cloudflare 注入脚本，整页哈希因此不同，但新 JS/CSS 入口与本地一致。
- 独立未登录 Chrome 打开正式地址，手机页面显示 2 款已揭晓、30 款待解锁，可进入档案并开始下载安装。截图和 HTTP 结果分别在 `artifacts/playwright/public-mobile-*.png` 与 `artifacts/releases/v0.2.1/anonymous-check.json`。

## v0.1.0 经典版（2026-10-09）

- 完整源码与原始封面：[私有 GitHub 仓库](https://github.com/NaOH42/install-game-simulator/tree/v0.1.0)
- 已发布站点：[装游戏模拟器 · 经典版](https://install-game-simulator-classic.feywasp4.chatgpt.site)（Sites 默认仅所有者可访问）
- Git 源码提交：`c98b3523050e7e298bc3928123848c0bbb35767c`，标签 `v0.1.0`。
- 独立发布源码提交：`c87eff45774a0dcdf906a33a85f27493a879dd7e`。
- Site ID：`appgprj_6ac9082a29988191b4945e371e584c78`。
- Deployment ID：`appgdep_6ac909863ff481918681bb4c3d5c0fab`，已回读 `succeeded`。
- 本地构建留存在 `artifacts/releases/v0.1.0/site/dist/`；发布包 `artifacts/releases/v0.1.0/site-v0.1.0.tar`。

经典版保留 24 款游戏、安装后自动产生收益的玩法。本地 `gameplay/resource-management` 分支继续开发新玩法，不覆盖经典版站点和 Git 标签。站点与本地存档因浏览器来源不同，分别保存。

## v0.2.0 公开版（2026-10-10）

- 公开免登录站点：[装游戏模拟器](https://install-game-simulator.feywasp4.chatgpt.site)。用户已明确授权当前版本公开发布；访问权限回读为 `public`。
- 分支：`gameplay/resource-management`，游戏源码提交 `434bda8575f327c0a138360c55f70efa9abdabb3`。源码仍在本地留存，本次未更新私有 GitHub 仓库或覆盖经典站点。
- 游戏增加至 32 款，新增 8 张独立生成的梗游戏封面与商店专区。
- 运行与安装分离，加入资源竞争、低配运行惩罚、每类 5 种硬件及有上限的系统迟滞效果。
- 新存档使用 `save.v2` / `backup.v2`，首次只读迁移旧存档，保留旧版原数据。
- 类型检查、57 项测试、构建、数值模拟与 32 张封面检查通过；收尾修复极小视口覆盖桌面布局，实际浏览器证据与限制见 `validation.md`。
- 包含最新硬件柜台精简与全部 32 款游戏档案梗文案。
- 独立站点发布源码提交：`662aeca6cb7db015faa43c96ab6dc2ecf7cd1746`。
- Site ID：`appgprj_6ac926a0d608819187bb50773515c918`。
- Saved version ID：`appgprj_6ac926a0d608819187bb50773515c918~appgver_f11a3ad03504819195078531ec14cd2b`。
- Deployment ID：`appgdep_6ac92745be2881918e2b18d3cfcf5cb3`，返回 `succeeded`；站点状态回读为 `active`。
- 构建快照：`artifacts/releases/v0.2.0/site/dist/`；发布包：`artifacts/releases/v0.2.0/site-v0.2.0.tar`。本地发布包 SHA256：`dea390e5cb8f52b8ce3b56ad529dd35e5d720375a0778c39bf4ef05b4333c563`。
- 不带 Cookie、Authorization 或访问绕过令牌的首页请求返回 HTTP 200，未跳转登录；主程序、样式和 Three.js 动画文件均匿名返回 HTTP 200 且哈希与发布快照一致；32 张封面匿名 HEAD 均返回 HTTP 200 / image/png。
- 本轮线上浏览器自动读取连续超时，未完成线上交互实玩复验；沿用此前同一构建的本地浏览器验证，不将其记作线上交互证据。

公开版与本地、经典版使用不同来源，各自保存浏览器存档，不自动同步。经典版的站点、访问设置及 Git 标签保持原状。
