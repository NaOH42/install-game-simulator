# 成果卡的 TOY 玩家资料接入

核实日期：2026-10-12。此次只实现本地功能，不发布或提交平台审核。

## 官方能力与实际边界

- [TOY 官方 SDK 文档](https://www.bilibili.com/toy/publish/sdk)：发布站点当前公开的 `SdkDoc` 文档与内置 TypeScript 声明已逐项核对。
- [官方运行时 SDK](https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js)：通过脚本挂载 `window.toy`，无需新增第三方 npm SDK。
- `getUserProfile(): Promise<{ avatar: string; nickname: string; toyOpenId?: string }>` 返回头像、昵称，以及可能存在的当前 Toy 假名标识。官方明确 **不向 Toy 提供 UID/MID 或登录令牌**。
- 第一次读取资料必须由玩家操作触发，平台展示自己的数据确认弹窗。已有有效授权可由平台复用；拒绝、未登录、外部手机浏览器不支持时会 reject。没有文档化的静默资料读取或独立登录接口。
- 本项目只保留 `{ name, avatarUrl }`。主动丢弃 `toyOpenId` 和任何其他返回字段，不用它伪装成 UID，不输出日志或写入存档。身份缓存仅保存在当前页面内存，导出卡片可包含玩家主动选择的昵称和头像。

## 调用契约

1. 成果卡打开时调用 `prepareToyIdentity()` 预加载官方 SDK，8 秒超时，不读个人资料，不弹授权。在 App 内同时预查相册能力，避免保存点击时异步等待丢失用户手势。
2. `readToyIdentity()` 仅读取本页已授权的内存缓存；首次返回游客。
3. 玩家点击“添加 B站昵称和头像”后直接调用 `loginToyIdentity()`，内部同步发起官方 `getUserProfile()`，不在用户手势前插入脚本加载或能力检查的 await。
4. SDK 未准备好时不排队自动弹窗，返回提示，玩家稍后点击重试。资料授权等待最多 60 秒；底层仍有未结束弹窗时不重复调用，超时后到达的资料忽略。
5. 失败或拒绝返回明确状态，游客卡片继续使用。不轮询，不调用自建服务。

`loginToyIdentity` 是项目按钮操作的名称，并不代表 SDK 存在 `login()` 方法；平台未登录时提示玩家先完成 B站登录。

## 宿主验证

线上预览页面实测外壳为 `https://www.bilibili.com/toy/preview/.../index.html`，实际游戏 iframe 为 `https://www.bilibilitoy.com/toy/preview/.../index.html`，iframe 带 `referrerpolicy="no-referrer"`。

适配器只接受精确 HTTPS origin 与 `/toy/<目录>/` 路径；拒绝端口、仿冒后缀域名和非 Toy 页面。若浏览器暴露直接父 origin，要求为 `https://www.bilibili.com`。

[Location.ancestorOrigins 官方浏览器文档](https://developer.mozilla.org/en-US/docs/Web/API/Location/ancestorOrigins)明确：`no-referrer` 可将父 origin 遮蔽成 `"null"`。所以该值缺失或被遮蔽时，不拒绝官方 `www.bilibilitoy.com` 内容 iframe。SDK 加载之前注册捕获阶段的 message 检查，针对官方运行脚本所用 `toy-sdk-rpc` 信道，仅允许 `source === window.parent` 且 `origin === https://www.bilibili.com` 的消息进入 SDK。检查不依赖 referrer 或 query 参数，也不读取 cookie。官方 SDK 原有保护会将首次父窗口 hello 的 origin 绑定到后续请求；额外检查避免未知父窗口抢先成为受信宿主。浏览器未接通官方父窗口时由 SDK 超时降级游客，其他浏览器消息不受影响。

## 头像与导出

官方 SDK 文档说明头像已统一为 HTTPS / p0 CDN 域名。适配器只接受 `p0.hdslb.com` 与 SDK 兼容的 `i0/i1/i2.hdslb.com` 图片地址，拒绝任意外域、data、javascript、带用户名密码等地址。

匿名 HEAD 验证 `https://p0.hdslb.com/bfs/face/member/noface.jpg` 返回图片及 `Access-Control-Allow-Origin: *`、`Cross-Origin-Resource-Policy: cross-origin`。这证明所测公共头像路径允许匿名 CORS，并不保证每个玩家头像的 CDN 缓存都相同。因此卡片渲染须在设定 `img.src` 之前设置 `crossOrigin = 'anonymous'`，捕获加载失败并回退默认头像。不能使用无 CORS 图片污染 canvas，也不通过第三方代理转发玩家头像。

## 分享、相册与截图

- 文档公开 `saveImageToAlbum({ base64Data, hintMsg })`：仅 B站 App；base64 字符串含前缀的长度有 5 MB 上限，建议控制在 2 MB 内。也支持平台可访问的图片 URL。本项目的 `saveToyCardImage(dataUrl)` 仅在主动点击、TOY 宿主与 BiliApp 环境、已准备好的 SDK、预加载阶段官方 `isSupport('saveImageToAlbum')` 为真时调用；保存点击链在首次 await 之前同步进入 `saveImageToAlbum`。返回非空 `localPath` 才报告成功。其余情况返回 false，供界面回退浏览器保存图片或长按保存。
- `share({ path })`：仅 B站 App，分享当前 Toy 内的相对页面链接，不等同于分享本地成果卡图片。
- `getQrCode({ path?, size? })`：App / Web 可用，返回 `{ base64, url }`，只能编码当前 Toy 页面的链接。若将来使用二维码，不在 query 中携带个人资料。
- 未找到文档化的 DOM 截图或图片转码接口。本项目自行渲染成果卡即可。
- 当前运行脚本中有 `sharePicture`，但本次所见公开能力文档和公开声明未列出；本轮不依赖该未文档化方法。

## 验证范围

`src/platform/toyIdentity.test.ts` 验证严格域名与父 origin、非 TOY 不加载 SDK、不静默读取身份、脚本单次加载与超时、用户手势、profile 字段白名单、资料拒绝与不可用、重复点击单请求、授权超时后忽略迟到结果。测试使用合成资料，不读取或记录真实玩家身份。

本地通过不能代表线上玩家资料授权已通过。B站 App 真机与真实授权 UI 仍需在下一次获得发布授权后的 TOY 预览中验证；本轮不冒充完成该平台验收。
