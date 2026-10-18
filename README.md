# FileHub —— 局域网网盘

基于 **Node.js + TypeScript + Hono + PGlite + Drizzle** 的个人/家庭局域网网盘，提供 WebUI 入口。

- 免安装 PostgreSQL，数据库内嵌（PGlite 文件模式）
- 账号密码登录，多用户隔离，管理员可在 WebUI 管理用户
- 电脑/手机双模式界面（响应式 + 手动切换）
- 图片灯箱预览（缩放/双指捏合/滑动切换）、视频播放（xgplayer，**长按加速，倍速可在个人设置中调整：默认 2x，最高 5x**）
- 文档预览：PDF（浏览器内嵌）/ EPUB / Markdown / 纯文本；音频在线播放（原生播放器，支持播放列表）
- 图片/视频缩略图：服务端后台任务统一生成 JPEG 并缓存（图片走 @napi-rs/canvas(Skia) 解码，视频用自带 ffmpeg 抽帧，黑屏帧自动跳过），串行执行、带进度、可停止；WebUI 可在「缩略图/图标」间切换，默认缩略图；设置页可手动补齐/重建/清理缓存（仅管理员）
- 模块化架构，符合开放封闭原则：新增功能不改核心代码

## 快速开始

```bash
npm install        # 安装依赖
npm run build      # TypeScript 编译到 dist/

npm run serve      # 启动服务，默认 http://0.0.0.0:3880（首次启动自动初始化）
```

启动后浏览器访问 `http://localhost:3880`（局域网内其他设备用启动日志里打印的局域网地址），
首次访问会引导创建管理员账号。

开发模式（免编译）：

```bash
npm run dev        # tsx watch 启动（无参数，配置读 ~/.filehub/config.json）
```

## 启动参数（serve 脚本）

`npm run serve`（或 `npm start`）通过 npm 的 `preserve` / `prestart` 钩子先执行 `npm run build`，
再启动编译后的 `dist/server/cli.js`；参数解析统一在 `src/server/cli.ts`：

```bash
npm run serve                                       # 默认当前目录，0.0.0.0:3880
npm run serve -- --workdir "D:\my hub" -H 0.0.0.0 -p 9000
```

选项：

| 选项 | 说明 |
| --- | --- |
| `--workdir, --dir <path>` | 工作目录（网盘根目录，默认当前目录） |
| `-H, --host <host>` | 监听地址（默认 `0.0.0.0`，局域网可访问） |
| `-p, --port <port>` | 监听端口（默认 `3880`） |
| `-h, --help` | 显示帮助 |

启动日志会打印本机与局域网访问地址。首次启动自动初始化（生成配置、应用 SQL 迁移）；
用户管理在 WebUI「用户管理」面板完成（管理员可见）。

## 分发与加入 PATH

`npm run build` 会在 `dist/` 里一并生成跨平台启动脚本：

```
dist/
├── filehub.bat     Windows 启动脚本
├── filehub.sh      Linux/macOS 启动脚本（可执行）
└── server/…        编译产物
```

把 `dist/` 目录加入 `PATH` 后，即可在任意目录直接启动：

```bash
filehub --port 9000                # Windows（cmd / PowerShell）
filehub.sh --port 9000             # Linux / macOS
```

脚本通过自身所在目录定位 `server/cli.js`，参数全部透传（`--workdir/--dir`、`-H/--host`、
`-p/--port`、`-h/--help`）。

> 分发时请把整个项目目录（含 `node_modules/`、`sql/`、`dist/`）一起交付：服务端在运行时
> 需要 `node_modules`（hono/pglite/@napi-rs/canvas/ffmpeg-static 等）以及 `node_modules/xgplayer`
> 的浏览器端产物，迁移 SQL 从项目根目录的 `sql/` 读取。目标机器需安装 Node.js ≥ 20.11。

### 关于 ffmpeg（视频封面）

视频封面由服务端用 ffmpeg 抽帧生成，ffmpeg 二进制来自 `ffmpeg-static` 依赖（安装时按平台
下载，Windows/Linux/macOS 各约 80MB），不需要使用者另外装 ffmpeg。

- **装不上/下载慢**：`ffmpeg-static` 默认从 GitHub Releases 拉二进制。GitHub 不可达时用镜像
  重装即可（npmmirror 有完整同步）：
  ```bash
  # Windows PowerShell
  $env:FFMPEG_BINARIES_URL='https://cdn.npmmirror.com/binaries/ffmpeg-static'; pnpm install
  # Linux / macOS
  FFMPEG_BINARIES_URL='https://cdn.npmmirror.com/binaries/ffmpeg-static' pnpm install
  ```
  npm 用户把 `pnpm install` 换成 `npm install` 即可。若已经装过、只是缺二进制，
  用 `pnpm rebuild ffmpeg-static`（npm：`npm rebuild ffmpeg-static`）重跑一次安装脚本。
- **pnpm 用户注意**：pnpm 默认拦截依赖的安装脚本，而 ffmpeg 二进制正是由
  `ffmpeg-static` 的 install 脚本下载的。本项目已在 `pnpm-workspace.yaml` 的
  `allowBuilds` 里放行 `ffmpeg-static`（缺失时按 pnpm 提示 `pnpm approve-builds` 放行即可），
  否则装完会发现 `node_modules/ffmpeg-static/ffmpeg.exe` 不存在，视频封面全部生产不出来。
- **想用自己的 ffmpeg**：设置环境变量 `FILEHUB_FFMPEG=/path/to/ffmpeg` 可覆盖内置二进制
  （优先级最高），其次是 `ffmpeg-static` 内置二进制，最后回退到 PATH 里的 `ffmpeg`。
- 注：`ffmpeg-static` 分发的 ffmpeg 为 GPL 许可，商用分发前请留意。

## 公网访问（Cloudflare Tunnel）

FileHub 默认只面向局域网。想在外网访问（无需公网 IP、无需路由器端口映射），可以用
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)：
由本机运行的 `cloudflared` 主动向 Cloudflare 建立**出站**连接，把本地
`http://localhost:3880` 映射到一个带 HTTPS 的公网域名，证书自动签发，全程不开放入站端口。

### 前置

1. 已按「快速开始」在本机启动 FileHub（默认 3880 端口）。
2. 安装 `cloudflared`：
   - Windows：`winget install Cloudflare.cloudflared`（或去 GitHub Releases 下载 exe）
   - macOS：`brew install cloudflared`
   - Linux：按[官方下载页](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)安装

> ⚠️ 首次使用请先在本机访问 `http://localhost:3880` 完成**管理员账号创建**，再对外暴露。
> `/api/auth/setup` 在系统还没有任何用户之前是开放的——先占住管理员，否则第一个打开
> 公网地址的人可能抢先创建管理员。

### 方式一：临时隧道（免账号，几秒钟）

```bash
cloudflared tunnel --url http://localhost:3880
```

运行后会打印一个随机的 `https://xxxx.trycloudflare.com` 地址，直接发给对方即可访问；
关掉进程即失效。适合临时演示、给朋友分享。

### 方式二：命名隧道（绑定自己的域名，长期使用）

1. 在 Cloudflare 控制台绑定一个域名并完成 NS 接入。
2. 登录并创建隧道：

```bash
cloudflared tunnel login
cloudflared tunnel create filehub
```

   `create` 会生成一个 `<TUNNEL_UUID>.json` 凭证文件（默认在 `~/.cloudflared/`）。

3. 编辑 `~/.cloudflared/config.yml`：

```yaml
tunnel: filehub
credentials-file: ~/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: filehub.example.com      # 换成你的域名
    service: http://localhost:3880
  - service: http_status:404           # 兜底：未匹配域名一律 404
```

4. 绑定 DNS 并启动：

```bash
cloudflared tunnel route dns filehub filehub.example.com
cloudflared tunnel run filehub
```

5. （可选）注册为后台服务，开机自启：

```bash
cloudflared service install          # Windows（管理员）
sudo cloudflared service install     # macOS / Linux
```

### 注意事项

- **先建管理员再开公网**：见上方前置说明。
- **登录鉴权就是第一道门**：FileHub 用账号密码 + HttpOnly Cookie（JWT）鉴权，建议强密码。
  如需更严格，可在 Cloudflare Zero Trust 里给该域名叠加 **Access 策略**（邮箱验证码 / 一次性 PIN 等）。
- **大文件**：Tunnel 支持 HTTP Range / 流式播放，但 Cloudflare 免费版对单连接时长与带宽有限制，
  超大文件建议仍走局域网或改用对象存储中转。
- **HTTPS 已自动处理**：出口即 HTTPS，Cookie（SameSite=Lax）与 JWT 在自有域名下正常工作。
- 无需路由器端口转发；FileHub 的 `-H` 保持默认 `0.0.0.0` 或 `127.0.0.1` 均可，
  因为 `cloudflared` 是通过本地回环地址连接的。

## 目录布局（真实目录模式）

**工作目录即网盘根目录**：工作目录里的真实文件/文件夹直接在 WebUI 中可见可管理（外部放入的文件立即可见，删除/重命名也直接作用于磁盘）。系统数据全部收纳在工作目录的 `.filehub/` 元数据目录中，列表中被自动忽略。

```
<workdir>/                      网盘根目录（真实文件系统）
├── .filehub/                   系统元数据（列表中被忽略）
│   ├── config.json             配置（host/port/jwtSecret/sessionDays）
│   ├── sql/                    迁移 SQL
│   ├── data/                   PGlite 数据库（仅存用户账号）
│   ├── .cache/                 缩略图 / 视频封面缓存
│   ├── uploads/tmp/            上传中转（落盘后立即 rename 到目标位置）
│   └── modules/               外部模块（*.js，启动时自动加载）—— 功能扩展点
├── 你的文件/…                  任意真实文件/目录，直接可见
```

> 数据库不再记录文件节点（节点 id = 相对路径的 base64url），PGlite 只保存账号体系。
> 历史版本（uuid 分桶存储）升级后，旧文件会出现在工作目录的「历史文件」文件夹中。

## 架构与扩展（开放封闭原则）

核心只依赖模块契约，所有功能都是模块：

```
src/server/
├── core/        配置/路径/数据库/鉴权/存储/事件总线/模块注册表（对修改关闭）
├── modules/     health、auth、files、admin（对扩展开放）
├── db/          Drizzle schema
└── index.ts     组装：鉴权闸门 → 模块挂载 → 静态资源
```

### 扩展方式一：外部模块（零侵入）

把 `examples/hello-module.js` 复制到 `~/.filehub/modules/`，重启即生效：

```js
export default {
  name: 'hello',
  register(ctx) {
    ctx.app.get('/api/hello', (c) => c.json({ hello: 'world' }));      // 新路由
    const files = ctx.service('files');                                // 复用内置服务
    ctx.bus.on('files:uploaded', ({ node }) => { /* 事件挂钩 */ });      // 订阅事件
  },
};
```

### 扩展方式二：内置模块

在 `src/server/modules/` 新建模块并实现 `FileHubModule` 接口，在
`src/server/modules/index.ts` 的清单里追加一行注册即可，核心代码无需改动。

### 可用能力（CoreContext）

| 成员 | 说明 |
| --- | --- |
| `ctx.app` | Hono 实例（`/api/*` 已过统一鉴权，`c.get('user')` 取当前用户） |
| `ctx.db` / `ctx.pg` | Drizzle（类型安全查询）/ PGlite 原始句柄 |
| `ctx.storage` | 存储服务：`putStream / adoptFile / openRange(支持Range) / deleteKeys` |
| `ctx.service('files')` | 文件服务：列表/建目录/重命名/移动/递归删除/搜索/统计 |
| `ctx.bus` | 事件总线：`files:created / files:uploaded / files:updated / files:deleted` |
| `ctx.config` / `ctx.paths` | 配置与目录 |

### WebUI 约定

前端基于 **hono JSX renderer**：`src/server/webui/page.tsx` 渲染单文档页面，全部样式
（`styles.ts`）与客户端脚本（`client/` 目录，构建时由 esbuild 打包为 IIFE 并内联，
`client-bundle.gen.ts` 为自动生成的字符串模块）都内联进 HTML——项目里没有独立的
html/js/css 文件，xgplayer 等第三方产物也在启动时读入并内联。

- 手机/电脑模式由 `body.mode-mobile` 驱动；文件显示方式（缩略图/图标）为浏览器本地配置
  （`fh:thumbs`，默认缩略图），顶栏按钮切换
- 个人设置面板（账号菜单 → 个人设置）：可设置长按加速倍数（浏览器本地配置
  `fh:longPressRate`，默认 2x，最高 5x）；只读展示当前服务工作目录，数据来自 `GET /api/server/info`
- 文档预览：PDF 用 iframe 调用浏览器原生 PDF 查看器；EPUB 由前端解包渲染；Markdown 经
  marked + DOMPurify 渲染；TXT 按 UTF-8/GB18030 解码后展示
- 音频播放：HTML5 `<audio>` 原生播放器，支持播放列表切换、上一首/下一首与下载
- 缩略图接口 `GET /api/files/:id/thumb?s=160|384|768`：**只读缓存，不在请求里生成**
  （没生成好就 404，前端回落图标）；图片支持 png/jpeg/gif/webp/bmp/ico/avif/svg，
  视频封面由服务端 ffmpeg 抽帧
- 视频封面抽到全黑帧会自动往后换点位重试（黑屏片头/淡入很常见），全片皆黑时才退回黑封面
- 缩略图/视频封面缓存位于 **工作目录 `.filehub/.cache`**（可配置 `thumbDir`），该目录在列表/搜索中被忽略

### 缩略图的生成时机

生成全部由**服务端后台任务**完成，请求路径不生成 —— 否则打开一个有几百个未缓存视频的目录，
浏览器会并发拉出几十个 ffmpeg，把 CPU 打满。任务逐项串行执行，进度在设置页可见：

| 时机 | 范围 | 说明 |
| --- | --- | --- |
| 服务启动后 | 全库图片 + 视频，两档（384/160） | `missing` 模式的启动任务：只生成还没有的，**不覆盖已有缓存**，不阻塞启动 |
| 新文件上传后 | 该文件，两档 | `files:uploaded` 入队，插进同一条串行链（可与全库任务交错），不单独开任务 |
| 设置页手动触发 | 全库，两档 | 仅管理员：`missing`（补齐缺失）/ `force`（全部重建），见下 |

> - 任务**不是**查数据库索引：真实目录模式下节点由文件系统推导，任务按 `MAX_SCAN_DEPTH` 下钻遍历工作目录。
> - 目录浏览时 `/thumb` 只命中缓存；列表接口会返回 `thumbsRunning`，前端据此在任务期间每 4 秒
>   静默重载列表，让缩略图逐步显示出来，任务结束后自动停。
> - `missing` 模式对**视频封面额外体检**：若缓存里是纯黑封面（历史版本/早期抽帧留下的）就当作缺失
>   重新生成 —— 所以重启后的补齐会顺手修好黑封面，而不是一直显示黑块。
>   确认「抽帧只能得到黑帧」的视频会记在进程内，避免每轮任务都为其重跑 ffmpeg。
> - 生成失败会记入内存失败表（10 分钟），避免坏文件被反复尝试；手动任务会清空该表以便重试。
> - 缓存写入是**原子**的（先写临时文件再改名），进程被中断不会留下半截 JPEG 被长期当成有效缓存。

### 浏览器缓存与「重启后变回黑图」

`/thumb` 曾用 `max-age=604800`（一周）强缓存，导致一个很隐蔽的问题：重建封面时前端靠时间戳
参数看到了新图，**重启后页面用回原始 URL，浏览器直接吐自己一周前缓存的旧黑图**，看起来像
「服务端重启把缩略图变黑了」。现在改为：

- `cache-control: private, no-cache` + `ETag`（取缓存文件的大小 + mtime）
- 未变化 → `304`（只花一次极小的复验请求）；缓存被重建/清理 → ETag 变化 → 立刻返回新图

这样无论重启、换设备还是清缓存，浏览器都不可能再显示与缓存不一致的旧图。

### 缩略图维护（设置页，仅管理员）

账号菜单 → 个人设置 → **缩略图维护**（`role=admin` 才显示）：

- **补齐缺失**：只生成还没有的（`missing`）—— 同时会顺手修掉纯黑视频封面
- **全部重建**：重新解码/抽帧并覆盖已有缓存，用于修复黑屏封面或损坏缩略图；
  服务端后台任务，面板显示 `已完成/总数` 进度，可随时「停止」，也可关掉面板继续跑
- **清理过时**：删除以下缓存文件，返回各类计数 ——
  源文件已不存在、源文件已被修改（源 mtime 晚于缓存）、类型已不再适用（不再是图片/视频）、
  无效残留（尺寸不在白名单、写入中断的临时文件等）

对应接口（均仅管理员，未登录 401 / 非管理员 403）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/files/thumbs/status` | 缓存条目数/占用字节/目录 + 当前任务进度 |
| POST | `/api/files/thumbs/rebuild` | body `{ mode: 'missing' \| 'force' }`，返回 202；已有任务在跑返回 409 |
| POST | `/api/files/thumbs/rebuild/cancel` | 请求停止当前任务 |
| POST | `/api/files/thumbs/clean` | 清理过时缓存并返回 `{ scanned, removed, freedBytes, reasons }` |


## 安全说明

- 密码使用 scrypt 加盐哈希；会话为 HttpOnly Cookie（SameSite=Lax）+ JWT，有效期 30 天
- 上传文件名不参与磁盘路径（uuid 落盘），无路径穿越风险
- HTML/SVG 等可内联执行脚本的类型在预览接口强制 `attachment` 下载，规避存储型 XSS
- 上传走原始字节流（支持大文件），下载/播放支持 HTTP Range 断点与流媒体拖动
- 默认仅面向可信局域网使用；如需公网访问，推荐用 Cloudflare Tunnel（见「公网访问」章节），
  或自建反向代理并启用 HTTPS

## 已验证

- API 冒烟：认证全流程、上传/下载、Range（206/416/后缀区间）、重命名/移动/递归删除、搜索、管理员接口鉴权（403）、多用户数据隔离
- 真实目录模式：外部放入工作目录的文件/文件夹立即在 WebUI 可见；上传/重命名/移动/删除直接作用于磁盘；`.filehub/` 系统目录自动隐藏；缩略图与视频封面（外部文件同样支持）缓存于 `.filehub/.cache`
- 缩略图链路（@napi-rs/canvas + ffmpeg-static）：大图缩放/小图原样直通/透明区铺白/SVG 栅格化/损坏文件回退图标、
  视频抽帧与竖屏方向、160|384|768 各档与非法尺寸回落默认档、缓存命中与 ETag 复验（304）、
  请求路径不自作生成（未缓存即 404）均实测通过
- 视频封面黑帧处理：黑屏片头视频实测能自动往后取到正常帧（封面平均亮度 128）；
  全片皆黑仍会给出封面且不反复重抽；预置在缓存里的纯黑封面会被 `missing` 任务自动重生成
- 缩略图任务化：启动任务按「媒体数 × 2 档」串行推进、二次运行全部跳过、上传入队后可取到缩略图、
  缓存目录无 `.part` 残留（原子写入）
- 缓存一致性回归：铺陈「旧黑封面 + 浏览器持有旧 ETag」后，重建完成再用旧 ETag 复验返回 200 并换图，
  证明重启/复用缓存不会再显示旧的纯黑封面
- 清理口径（无源文件/源已修改/类型不符/无效残留）计数与保留项正确（含视频 `v_` 前缀不被误判）；
  维护接口未登录 401、普通用户 403、管理员可用，`thumbs/*` 静态路由未被 `/:id` 抢匹配
- GUI 实测（Chromium）：登录/登出、文件浏览、图片灯箱、真实 mp4 播放、长按加速（个人设置）、手机模式、模式切换、搜索、用户管理面板、个人设置页展示工作目录、PDF/Markdown/TXT/音频预览
- WebUI：hono JSX renderer 单文档页面（全内联，零外部引用）
- serve 脚本：`npm run serve -- --workdir/-H/-p` 实测（自动初始化、指定端口、health 正常）
