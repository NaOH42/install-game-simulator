# TOY 成果卡版本更新 · 2026-10-12

## 当前状态

- 用户要求「更新下 TOY」，更新既有作品，不创建新作品。
- 发布前 `mylist --json` 回读：ID `43031864541184`，名称「装游戏模拟器」，`published`、`PUBLIC`、`GAME`。
- 固定地址：`https://www.bilibili.com/toy/install-game-simulator/index.html`。本次保留名称、封面、图标、可见性、分类和地址标识；更新只传包体。
- 新包已上传预览：**https://www.bilibili.com/toy/preview/preview_bGKTgeJY/index.html**。
- 用户明确回复「已查看预览，提交审核」。提交前逐项核对 36 个发布文件的 SHA-256 与预览清单一致；已使用原参数加 `--yes` 提交成功。
- 2026-10-12 13:14（UTC+8）在线回读为 `auditing`、`PUBLIC`、`GAME`，ID 和固定地址未变。**新版审核中，尚未确认审核通过或正式上线。**
- 提交返回的新预览地址：**https://www.bilibili.com/toy/preview/preview_37cJth5h/index.html**。提交结果与回读保存在 `submission.json`、`online-status.json`。

## 本次包内容

新增成果卡：桌面留影、永久游戏收藏、当前硬件型号、PNG 保存和分享文案；支持 TOY 官方 SDK 的用户主动授权昵称/头像与 App 相册保存回退。手机署名入口及固定保存栏已适配。包含工作区已完成的硬件价格调整与柜台排序，详见 `balance-2026-10-12.md`；保留原来的 32 款游戏、逐步解锁与安装演出。

发布目录 `artifacts/releases/toy-2026-10-12-achievement/package/`，36 文件、13,337,782 字节。使用独立 Vite 相对路径配置，复用原发布的 32 张同尺寸 WebP 副本，PNG 原图及旧发布包保留。`package-manifest.json` 记录每个上传文件的 SHA-256。新版目录由根代理管理，不自动清理。

## 验证

- 本次重新通过类型检查、32 张封面来源/比例检查及 TOY production build。
- 发布 doctor：`ok: true`、`findings: []`，无 ERROR/WARN。
- 成果卡实现验收：全量 150 测试通过、两档桌面及三种手机尺寸已测；细节见 `achievement-card-2026-10-12.md`。本轮未重复改动游戏源码。
- 真实新预览在独立未登录 Chrome 浏览器加载正常，WebP 封面实际加载，未出现页面异常或相关失败网络响应。
- 从收藏页生成 1080×1864 游客卡，下载 PNG 成功，图片 424,932 字节，无素材缺失警告。
- 手机 390×844 无横向溢出，保存按钮可触及。
- 打开卡片前未加载身份 SDK；打开后官方 SDK 脚本加载成功，实际内容宿主为 `www.bilibilitoy.com`，父源为 `www.bilibili.com`。
- 外壳的 `pointer-lock` 警告为平台既有提示，本游戏未用该能力。

## 平台预览的身份限制

新预览外壳没有 `window.__TOY_META__.toy_id`。实际点击「使用我的 B站身份」后返回不可用，游客图仍可保存。

对比正式旧站：外壳已注入 `toy_id:43031864541184`。官方 `toy-host.js` 的 `getUserProfile` 路径先验证该上下文；缺失会在请求用户资料之前抛出 `toy id not available on host`。因此本次预览无法完成授权源于缺少平台作品上下文，不能归因于用户没登录；未注入 ID 绕过。

正式新版上线后仍须验证真实授权、拒绝及 App 相册。预览 SDK 加载和游客导出成功，不代表这些步骤已通过。

## 已执行提交

收到用户对本次预览的明确提交确认后，已按 TOY skill 使用**同参数**加 `--yes`；下方只作操作记录，不应重复提交：

```powershell
& '.\artifacts\releases\toy-2026-10-12\tools\toy.exe' update 43031864541184 'D:\装游戏模拟器\artifacts\releases\toy-2026-10-12-achievement\package' --json --yes
```

提交后已回读在线状态为审核中，保留返回的新预览地址。以后若修改包体，需要重新上传对应预览并按用户授权范围完成提交流程。

本次未推送 Git，未更新 GitHub Pages、Sites 或经典版站点。
