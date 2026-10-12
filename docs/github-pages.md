# GitHub Pages 发布

本项目是纯静态游戏。GitHub Pages 使用独立 `codex/github-pages` 分支根目录，源代码保存在 `gameplay/resource-management`。发布分支只保留构建资源和 `.nojekyll`，不修改经典版分支或已有版本标签。

## 构建与检查

安装项目依赖后，执行类型检查、规则测试、数值模拟和资源检查；为 Pages 单独构建，保留默认站点构建方式：

```text
pnpm exec tsc -b
pnpm test
pnpm balance
pnpm check:assets
pnpm exec vite build --base=/install-game-simulator/ --outDir artifacts/releases/v0.2.2/github-pages
pnpm exec vite preview --base=/install-game-simulator/ --outDir artifacts/releases/v0.2.2/github-pages --host 127.0.0.1 --port 5175 --strictPort
```

浏览器预览地址包含 `/install-game-simulator/`。检查商店封面、游戏详情、安装动画、首装庆祝图、任务管理器缩略图，以及刷新后任务继续。正式发布记录见 `releases.md`。

以后发新版本时，为 `outDir` 使用新的版本目录；不要直接在带 `.git` 的既有发布目录中重新运行清空输出的构建。验证过的产物复制到发布分支目录，不自动删除旧文件；在该独立目录中正常提交与推送，禁止强制推送。

v0.2.2 的构建快照和独立 Git 检出分别位于版本目录内的 `github-pages/` 与 `github-pages-publish/`。发布检出从远端 `codex/github-pages` 克隆，再复制新构建、写入 `.nojekyll` 与关联源码提交的 `release.json`。旧的哈希资源保留，避免已经打开的页面延迟加载失败；首页只引用本次新构建。验证通过后正常提交并快进推送，不修改 Pages 配置。

## 首次启用

在已验证产物目录中添加空 `.nojekyll`，初始化独立 Git 仓库并创建 `codex/github-pages` 分支，添加本项目 GitHub 远端，提交网站文件并推送。随后在 GitHub 仓库 Settings → Pages 选择 **Deploy from a branch**，分支 `codex/github-pages`、目录 `/`。也可以通过 GitHub 官方 Pages API 配置相同发布来源。

GitHub 会执行内置 Pages 发布流程。以构建返回 `built`、对应发布流程成功以及线上资源验证为完成依据，不能只依据推送成功。

## 路径与存档

- Vite 负责生成带项目基础路径的脚本、样式及 Three.js 动态模块地址；界面封面通过 `assetUrl` 使用同一个基础路径。
- 游戏目录数据仍使用 `/assets/covers/<id>.png`，原图、提示词、经济逻辑和存档格式不变。
- GitHub Pages 与原 `chatgpt.site` 地址属于不同来源，浏览器存档分别保存，不自动迁移。
- 发布目录不需要 `.env`、密钥、账号或服务器；访客无需 GitHub 登录。
- 本次部署不能替代中国大陆不同运营商的访问测试，实际打开速度以玩家网络为准。
