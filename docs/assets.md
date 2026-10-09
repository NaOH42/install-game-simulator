# 封面素材与来源

初版生成日期：2026-10-09。当前共 **32 张独立生成的位图封面**（初版 24 张，v0.2 新增 8 张），每款单独调用一次内置 `image_gen.imagegen`，未使用 CLI、生图 API runner、代码绘画或拼图拆分。工具没有提供可验证的具体模型版本，因此模型记录为 UNKNOWN，不标记 IMAGE2.5。

## 文件与呈现

- 所有原生结果为 **1024 × 1536 PNG（2:3）**，32 个 SHA256 互不相同。
- 项目原图：`assets/source/{game-id}.png`；运行素材：`public/assets/covers/{game-id}.png`。两份逐字节相同，全部已复制到项目。
- 单套运行资源合计 90.60 MiB（初版 67.86 MiB）。保留原图，不覆写默认生成目录；没有删除文件。
- 裁切只在页面通过 `aspect-ratio: 2 / 3; object-fit: cover` 进行，不拉伸、不修改位图。标题与商品信息由 UI 单独排版。
- 提示词、默认输出的确切路径、尺寸、字节数、哈希及逐张检查结果完整保存在 `assets/prompts/covers-manifest.json`。
- 工具原生文件目录：`C:\Users\10103\.codex\generated_images\01a11f09-1aea-7df2-8a83-924c33b9fe53\`。该目录仅作来源证明，网页资源不依赖此路径。

## 初版 24 张检查结果

首批四张分别覆盖策略、武侠、赛车、科幻，经读图确认后扩展剩余 20 张。生成过程中逐张查看完整图像，确认主体、主题差异、无标题文字、无拼图布局，以及 2:3 画面中的裁切安全性。以下焦点供商品页或安装背景展示使用；原图本身不做有损裁切。

| 游戏 ID | 类别 | 焦点 | 逐张读图记录 |
|---|---|---|---|
| red-alert | strategy | 50% 45% | 红云下坦克与要塞；坦克主体完整，红橄榄配色辨识明确。 |
| legend-sword | wuxia | 50% 45% | 白青长袍剑客、石桥与山谷；面部与持剑动作清楚。 |
| need-parking | racing | 50% 45% | 黄色跑车与湿停车场；车辆完整，黄色反光清晰。 |
| half-sleep | scifi | 50% 45% | 冷冻舱旁宇航员与轨道废墟；青色面罩是视觉焦点。 |
| war-canteen | strategy | 50% 45% | 炊事大锅指挥部与军营厨师；军事喜剧主题清晰。 |
| paladin-homework | wuxia | 50% 45% | 紫衣女剑客与空白卷轴；书房、剑光和人物无标题遮挡。 |
| car-school | racing | 50% 45% | 白色教练车与路锥；全车可辨，山景与暖色尘土。 |
| star-internet | scifi | 50% 45% | 橙衣宇航员、CRT 网吧与星系；人物居中，设备细节丰富。 |
| empire-dorm | strategy | 50% 45% | 教材与床架搭成的微缩城堡；宿舍帝国主题明确。 |
| moon-blade | wuxia | 50% 45% | 红衣女侠、月亮和屋檐；人物与弯刀辨识清楚。 |
| midnight-taxi | racing | 50% 45% | 黑黄出租车与雨夜街道；全车完整，暖冷反光对比。 |
| space-miner | scifi | 50% 45% | 大型采矿车、矿工与紫色小行星；蓝晶矿脉主体可辨。 |
| command-conquer | strategy | 50% 45% | 指挥官、沙盘与机甲；指挥官居中，战术题材明确。 |
| dragon-inn | wuxia | 40% 45% | 蒙面旅人与沙漠客栈；主体偏左，建议横向焦点40%。 |
| rally-rain | racing | 50% 45% | 蓝色拉力赛车穿越雨林；全车完整，飞溅水流增加动感。 |
| alien-cafe | scifi | 50% 45% | 六臂绿色外星咖啡师；蒸汽饮品与太空窗景辨识清楚。 |
| world-war-lan | strategy | 50% 45% | CRT 山城、网线与士兵；局域网战争主题独立可辨。 |
| immortal-exam | wuxia | 50% 45% | 绿衣书生御剑与云上考场；空白卷轴形成向上动势。 |
| speed-horizon | racing | 50% 45% | 橙色超级跑车与海岸日落；车身完整，地平线氛围清楚。 |
| galaxy-odyssey | scifi | 50% 35% | 银色飞船穿越跳跃门；飞船在画面上部，建议纵向焦点35%。 |
| frozen-throne | strategy | 50% 45% | 冰晶王座、军队与雪山；空王座主题明确，冰蓝配色。 |
| jade-dynasty | wuxia | 50% 45% | 翡翠白衣女侠与玉龙；人物上半身及玉龙面部清晰。 |
| neon-highway | racing | 50% 45% | 紫红跑车与霓虹高架；全车可辨，城市夜景独立。 |
| crisis-final | scifi | 50% 45% | 白色装甲探索者与浮空黑色巨构；旗舰科幻规模感明确。 |

## 原生文件与校验

所有尺寸均为 1024 × 1536；原图与运行素材的 SHA256 完全一致。下表原生文件名对应上文工具输出目录。

| 游戏 ID | 原生文件名 | SHA256 |
|---|---|---|
| red-alert | exec-dfde5b74-a3e5-4a1b-816d-99ba8ac11fb9.png | 72FAAC939ED21995C43205DFA02BAF7AC8D284EA02D5C4AE696E6C6554E49866 |
| legend-sword | exec-4ad188f6-2bb4-4789-8b10-cbcab7c864e3.png | 5369675C2D1A0DE242032034337C27CF5C690E53CCF518FCC69050FF282DF088 |
| need-parking | exec-8e7fd7e1-833a-4bd5-bdce-fb6ada2f2669.png | 85C9D0D8B73952F96CE736182C818FE3BEEFEBB3D565ECAB2104FBA833DAED18 |
| half-sleep | exec-08f1ec5d-17fb-4889-8973-6450d3f038f8.png | 73EF4FD10FB38A90C6C4553C40040214A638410A91910311AD526F9BCCD32FE1 |
| war-canteen | exec-e4608a83-6372-4045-b5de-5c52aa0c2cec.png | 17AA84B1C369E7E39E3E22659E0161F955FF1D6211D5B52F9EEACCE6C9247902 |
| paladin-homework | exec-407b558f-bccc-4f75-8d46-8c8a68f2178a.png | 7F3EE321AC71BACE5FB377BDDB6E3239D014B87B2E2DCEA0587B0BF2EE38C908 |
| car-school | exec-bbe28e3d-6ab0-4878-b7fa-db99e9efb807.png | 225539A5A9754FC991C36BECA1690FA2F3163CD05E3053088E152E123EE2990D |
| star-internet | exec-0dd91b34-19f3-4b93-88af-58a150b3beaf.png | FBB7E4A8968F4F5638493335FC882666D5BC5782037FAF0593AC2CFD56F1867D |
| empire-dorm | exec-d69f9c64-51ed-41f8-a646-db31ed399ab4.png | 1C7382CEEC74FDD56029C59542A1E6389639C886EF9BB423EEAC682FA4C2C5DB |
| moon-blade | exec-c758e0ad-19d7-4b23-b182-3b52e93d79d4.png | 73EDA6B3ECC4A6A7A055B685624CA69F185261267C77D0E256551DF61538C049 |
| midnight-taxi | exec-45b1ad88-323f-4d0c-8935-4c87854eb722.png | A685ABAFFA1AFF9AB5BA342EF1BD818ACD199B98F0FA91DCA929D2CA75401700 |
| space-miner | exec-d4b97808-0ff5-4346-9d0e-3f2b4f5a2a05.png | 9CBB8979E7DFB73F5211306161AA0ED2631C9B742753434F55AE88BFDE747092 |
| command-conquer | exec-1ee1bb64-d70c-4791-a121-21dfd591f2d9.png | 5387F94125941AC7172684861520345E10659D9121F6241F3915531A2758B34E |
| dragon-inn | exec-9eb6e61d-6ecc-456a-a2a2-e0d28a4a9def.png | BF5A4A4B15220B41FB2B7FDA1C80C8D2AE79FF2201BFD639D51F19527C44AF02 |
| rally-rain | exec-e20be26f-8cfc-452a-9253-c3a15eb1cc19.png | 0D3AED6A40077E03FAC9E43424F94C58D75B6910BFB60EA37DAC2F8C44DA01E4 |
| alien-cafe | exec-2d06ea2d-dd38-410e-b1a2-405d8fbda0b5.png | C85A4234BD204B75D08325AD2F78C3355595DC0DEC1AC1EF3C02CB90DBECC6AE |
| world-war-lan | exec-cea8e511-fb38-44ee-9203-5cce8a87eb80.png | 090F5F013E50D4646055A829BF0C8B1FE0A9C73D0354A767E257125B3932BC7F |
| immortal-exam | exec-dfa338cf-4454-419a-93f4-8edcb4395fe9.png | CB932F0DF3545BAB499F8D0B630D77F38F66EB8694AD638928208F8AD06D7151 |
| speed-horizon | exec-313e96e9-e4a7-4d6e-97d2-be998f504b4e.png | E5E41F5C8C62B6C41B6D536C2EB3CAD15A8ECD687EBE9F97CBA2399EF0FD2A93 |
| galaxy-odyssey | exec-2958a94f-d83c-490e-b080-b38512773f2e.png | 2F2A1D4E9BD565514225DD461E91D282821549409D4774B5F2C77904BEB16EE6 |
| frozen-throne | exec-61b01f4b-51f9-400a-b98b-82122f3077c4.png | F9E2941A95434B5F79CA41A44E6DD603F4F74FFDCEB746C2167A8CDBA16814AA |
| jade-dynasty | exec-bdbb25b4-3966-4bd3-a07b-630c24c5e36b.png | F2DFB9FC0C6E93762565C704A884900561796BE7B8188EDCBECDBF1354744219 |
| neon-highway | exec-42338a8a-6487-4e37-b1b6-ac846834d8ea.png | CE55A91B8E463E216E03ACC08DE219B65AB9C0CDED8709F9E699EB3944CD3D55 |
| crisis-final | exec-e5e67c20-5feb-46e6-8bef-d2608b831cd5.png | 8EEF57A9F9D901932932E23D42FE8C7CC90A8F0118EE9C53C878F4044CD35E8F |

## v0.2 新增 8 款网络梗游戏

新增封面全部逐款调用内置 `image_gen.imagegen`，每次只生成一款独立的 1024 × 1536 PNG。生成前读取下列官方 Steam 商店宣传图，作为构图与配色参考；提示词明确将人物或道具改为梗主体，并移除标题与其他文字。实际工具未披露模型版本，仍记为 UNKNOWN。

`assets/source/reference-*.jpg` 是来自官方商店的内部参考图；不放进 public，也不被游戏运行代码引用。`reference-mount-and-bargain.jpg` 是名单调整前读取的候选参考，最终改用《男朋友3》，该候选仅保留来源文件、没有生成或上架对应游戏。

| 游戏 ID | 原作官方参考 | 构图与梗主体读图检查 | 焦点 |
|---|---|---|---|
| elder-scrollbar | [The Elder Scrolls V: Skyrim Special Edition](https://store.steampowered.com/app/489830/) | 黑皮革底上的银色老人卷轴浮雕；致敬原作黑银徽记布局，老人、长须与空白滚动卷轴可辨。 | 50% 45% |
| cats-creed | [Assassin's Creed: Director's Cut Edition](https://store.steampowered.com/app/15100/) | 白兜帽猫咪、红腰带、罐头和蓝白虚化人群；原作站姿与冷光构图可辨，猫脸与罐头均完整。 | 50% 45% |
| dark-suffering | [Dark Souls Remastered](https://store.steampowered.com/app/570940/) | 火星废墟中的疲惫骑士握着手柄，巨型苦瓜靠在身旁；冷暖色与盔甲主题形成受苦梗。 | 50% 45% |
| junk-collector-4 | [Fallout 4](https://store.steampowered.com/app/377160/) | 复古卡通拾荒者竖拇指，购物车装满风扇与废铁；沿用官方当前宣传图的旧纸色和粗线条。 | 50% 45% |
| give-him-love | [Grand Theft Auto V](https://store.steampowered.com/app/271590/) | 黑线分格漫画构图、中央送花男子、花瓣直升机与爱心犬；致敬官方封面分格形式，一张完整插画而非拆图素材。 | 50% 45% |
| potato-servers | [Tom Clancy's Rainbow Six Siege](https://store.steampowered.com/app/359550/) | 战术干员握网线，土豆电池服务器在橙光中冒火；参考当前官方宣传图姿态和暖色爆破构图。 | 50% 45% |
| boyfriend-3 | [Battlefield 3](https://store.steampowered.com/app/1238820/) | 中央现代士兵抱玫瑰花束，蓝色烟雾与橙色躯干边光；参考 BF3 官方蓝橙持械人物构图。 | 50% 45% |
| one-more-turn | [Sid Meier's Civilization V](https://store.steampowered.com/app/8930/) | 困倦领袖抱咖啡杯、将军看表，背后跨时代文明与昼夜交界；参考官方人物加文明全景构图。 | 50% 45% |

《给他爱》沿用原作封面的分格漫画形式，整幅由一次生图调用生成；没有用程序拼图或拆成多个游戏封面。其余新增图均为单场景或单张完整主题构图。

新增运行资源与原图仍分别位于 `public/assets/covers/{id}.png` 和 `assets/source/{id}.png`。完整提示词、官方图 URL、参考本地路径、工具原生输出路径、尺寸、字节数、SHA256 与检查记录均追加进 `assets/prompts/covers-manifest.json`。

| 游戏 ID | 工具原生文件 | SHA256 |
|---|---|---|
| elder-scrollbar | exec-558293d3-adff-4113-8635-e2ac82c16030.png | 86CC59DA9181B250C28D8AB600F2438A81B89019E4CC98BA267EAB2DC0A8916F |
| cats-creed | exec-4430a8e6-014b-4562-9c03-7d877b3aec2f.png | B95AA49A164BAF32302F8546DA1FEF29E8474EECED3BBECB919DB06AF04CA3F2 |
| dark-suffering | exec-2793c0f9-fa67-4c69-a93a-f057d1d8beba.png | D6CF0E09381A86AC7E0FED343A7AC94626B71711AE71FBCAF61B46AB494AE332 |
| junk-collector-4 | exec-164f720c-b5ea-4aaf-a281-d1a1a1b6517f.png | C97818FBC0EF8FF7868044C6AC765F82254E2227642EF8D20BBACCCAA023635D |
| give-him-love | exec-5783616c-3586-4ecf-a2a7-0c4062a574e5.png | FDA75DE1D5207BFF53FBBB0980B0DEE9D94CCB7E93947947DE6878B0452078B5 |
| potato-servers | exec-8c10294d-2e66-405c-b674-4ffccd2ff295.png | 9C6DF2F6204C0D055A9717EF7296F14E80DA21F24BD092B0A56F1DE50FFBB856 |
| boyfriend-3 | exec-d1a116d4-1559-4044-88da-2bce4a1288c6.png | EC4B2B13E53DC993E0B02D974DA79985116E042677F6A0BF75240C503AFBCBB8 |
| one-more-turn | exec-ef46c289-83f2-4b7a-9691-8c0ff8fde191.png | 980E568EE23464953622CFD8491208637B54CAFBE20D0437760257FE9FD64D08 |

验证：`pnpm check:assets` 通过，共 32 张独立封面，全部 2:3 PNG，源文件与运行文件字节一致，裁切焦点和商品定义一致；运行封面合计 90.60 MiB。新增 8 张均逐张读图检查，未烘焙商品标题，主体安全；画面参考对应官方当前可读宣传图，并不声称复刻初版实体盒封面。

新增商品定义在 `src/game/expansion.ts`，联网 3 款、离线 5 款；CPU、RAM、GPU、网络需求为模拟器内的平衡数据，不是原作真实电脑配置。

