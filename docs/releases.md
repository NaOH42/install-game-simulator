# 版本留存

## v0.1.0 经典版（2026-10-09）

- 完整源码与原始封面：[私有 GitHub 仓库](https://github.com/NaOH42/install-game-simulator/tree/v0.1.0)
- 已发布站点：[装游戏模拟器 · 经典版](https://install-game-simulator-classic.feywasp4.chatgpt.site)（Sites 默认仅所有者可访问）
- Git 源码提交：`c98b3523050e7e298bc3928123848c0bbb35767c`，标签 `v0.1.0`。
- 独立发布源码提交：`c87eff45774a0dcdf906a33a85f27493a879dd7e`。
- Site ID：`appgprj_6ac9082a29988191b4945e371e584c78`。
- Deployment ID：`appgdep_6ac909863ff481918681bb4c3d5c0fab`，已回读 `succeeded`。
- 本地构建留存在 `artifacts/releases/v0.1.0/site/dist/`；发布包 `artifacts/releases/v0.1.0/site-v0.1.0.tar`。

经典版保留 24 款游戏、安装后自动产生收益的玩法。本地 `gameplay/resource-management` 分支继续开发新玩法，不覆盖经典版站点和 Git 标签。站点与本地存档因浏览器来源不同，分别保存。

## v0.2.0 本地版（2026-10-10）

- 分支：`gameplay/resource-management`，在本地提交留存，本轮未推送或覆盖经典站点。
- 游戏增加至 32 款，新增 8 张独立生成的梗游戏封面与商店专区。
- 运行与安装分离，加入资源竞争、低配运行惩罚、每类 5 种硬件及有上限的系统迟滞效果。
- 新存档使用 `save.v2` / `backup.v2`，首次只读迁移旧存档，保留旧版原数据。
- 类型检查、57 项测试、构建、数值模拟与 32 张封面检查通过；收尾修复极小视口覆盖桌面布局，实际浏览器证据与限制见 `validation.md`。
