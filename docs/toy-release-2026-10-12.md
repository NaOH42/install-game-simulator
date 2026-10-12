# TOY 发布准备 · 2026-10-12

## 当前状态

- 用户已授权安装 bilibili/toy skill 并发布本项目。
- 全局 skill 安装成功：`C:/Users/10103/.agents/skills/toy/SKILL.md`；官方 TOY CLI v0.6.2 存在本次发布的 `tools/` 内，下载通过官方 SHA-256 校验，未修改持久 PATH。
- 已通过官方 OAuth 登录 NaOH42；未将登录会话复制进项目。
- 上传前本地历史为空，在线 Toy 列表为空。此次为新建，正式 Toy ID 为 `43031864541184`。
- 用户明确回复「已查看预览，提交审核」后，于 11:53 提交成功；mylist 回读为 `auditing`、`visibility: PUBLIC`、`category: GAME`。**当前审核中，尚未确认公开上线。**
- 首次预览原始地址：https://www.bilibili.com/toy/preview/preview_RKemPVmU/index.html
- 提交时返回的预览地址：https://www.bilibili.com/toy/preview/preview_hlCo4TaL/index.html
- 审核通过后的正式地址：https://www.bilibili.com/toy/install-game-simulator/index.html （尚未验证过审访问）。

## 包与元数据

- 名称：装游戏模拟器；slug：`install-game-simulator`；分类：`GAME`；可见性：`public`。
- 发布目录：`artifacts/releases/toy-2026-10-12/package-webp/`。
- 列表封面：同级 `poster.png`，1200×900；可编辑排版为 `poster.html`，复用现有生成游戏封面。
- 包包含 32 款游戏、商店逐步解锁、手机适配、最新安装渐强及像素完成演出。
- 首次 PNG 包被服务端拒绝：`upload/init failed: status=200 code=307020 message=文件超过大小限制`；此时没有创建 Toy。
- 最终包 36 文件、13,308,462 字节。32 张生成封面保持 1024×1536 尺寸，仅编码为 WebP quality 88：94,999,891 字节变为 12,335,798 字节。PNG 原图和原站点资源保留。
- 独立 Vite 配置以相对 base 构建，并启用 `VITE_COVER_FORMAT=webp`。默认站点与 GitHub Pages 仍使用原 PNG。
- 桌面纹理 SVG 的括号改为等效 URL 编码，消除发布预检误判，不改变显示内容。

## 验证

- TOY doctor 最终 `ok: true`，无 ERROR、无 WARN；记录 `doctor-webp.json`。
- TypeScript 类型检查、production build、全套 16 文件 100 项测试、数值模拟通过。新增路径测试覆盖默认站点、GitHub Pages、TOY，以及外链/非封面不受影响，2 项通过。
- 最近玩法验证见 `install-feedback-2026-10-12.md`；本次不更改经济和安装规则。
- 本地发布子路径正常；1366×768、1920×1080、360×800、390×844、844×390 无页面横向溢出，任务刷新恢复。
- 真实 TOY 预览在未登录独立浏览器中加载成功，封面实际来自平台 WebP 地址、WebGL canvas 存在；390×844 无溢出，刷新前后任务进度均为 2%。验证期间未出现页面脚本异常或失败网络响应。记录 `preview-verified.log` 及 `toy-preview-*.png`。
- 平台外层 iframe 有 `Unrecognized feature: 'pointer-lock'` 警告，本游戏不使用该能力。未验证实体手机、B 站 App 内音频播放，未把预览成功表述为审核通过。

## 已执行提交

收到用户明确确认后，已以原参数加 `--yes` 提交，并查询 mylist/history 核对 Toy ID、状态、地址标识和公开设置。下方仅保留执行记录，**不可再次 create 导致重复发布**；今后同一 TOY 使用 `update 43031864541184 ...`，保留 slug。平台审核通过前不称已上线。

```powershell
& '.\artifacts\releases\toy-2026-10-12\tools\toy.exe' create 'D:\装游戏模拟器\artifacts\releases\toy-2026-10-12\package-webp' --title '装游戏模拟器' --slug install-game-simulator --category GAME --visibility public --poster 'D:\装游戏模拟器\artifacts\releases\toy-2026-10-12\poster.png' --json --yes
```

本次未推送 Git，未修改现有 GitHub Pages、Sites 站点或经典版发布。
