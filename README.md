# FileHub —— 局域网网盘

基于 **Node.js + TypeScript + Hono + PGlite + Drizzle** 的个人/家庭局域网网盘，提供 WebUI 入口。

- 免安装 PostgreSQL，数据库内嵌（PGlite 文件模式）
- 账号密码登录，多用户隔离，管理员可在 WebUI 管理用户
- 电脑/手机双模式界面（响应式 + 手动切换）
- 图片灯箱预览（缩放/双指捏合/滑动切换）、视频播放（xgplayer，**长按加速，倍速可在个人设置中调整：默认 2x，最高 5x**）
- 图片缩略图：服务端生成 JPEG 并缓存（jimp，纯 JS 无原生依赖），WebUI 可在「缩略图/图标」间切换，默认缩略图
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
> 需要 `node_modules`（hono/pglite/jimp 等）以及 `node_modules/xgplayer` 的浏览器端产物，
> 迁移 SQL 从项目根目录的 `sql/` 读取。目标机器需安装 Node.js ≥ 20.11。

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
│   ├── .cache/                 缩略图缓存
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
- 缩略图接口 `GET /api/files/:id/thumb?s=160|384|768`，支持 jpeg/png/gif/bmp/tiff，
  其余格式自动 302 回退原图
- 缩略图缓存位于 **工作目录 `.cache/`**（可配置 `thumbDir`），该目录在列表/搜索中被忽略；
  启动时后台预扫补齐缺失缩略图，新图片上传后经事件总线自动生成索引

## 安全说明

- 密码使用 scrypt 加盐哈希；会话为 HttpOnly Cookie（SameSite=Lax）+ JWT，有效期 30 天
- 上传文件名不参与磁盘路径（uuid 落盘），无路径穿越风险
- HTML/SVG 等可内联执行脚本的类型在预览接口强制 `attachment` 下载，规避存储型 XSS
- 上传走原始字节流（支持大文件），下载/播放支持 HTTP Range 断点与流媒体拖动
- 默认仅面向可信局域网使用；如需公网访问，推荐用 Cloudflare Tunnel（见「公网访问」章节），
  或自建反向代理并启用 HTTPS

## 已验证

- API 冒烟：认证全流程、上传/下载、Range（206/416/后缀区间）、重命名/移动/递归删除、搜索、管理员接口鉴权（403）、多用户数据隔离
- 真实目录模式：外部放入工作目录的文件/文件夹立即在 WebUI 可见；上传/重命名/移动/删除直接作用于磁盘；`.filehub/` 系统目录自动隐藏；缩略图（外部图片同样支持）缓存于 `.filehub/.cache`
- GUI 实测（Chromium）：登录/登出、文件浏览、图片灯箱、真实 mp4 播放、长按加速（个人设置）、手机模式、模式切换、搜索、用户管理面板、个人设置页展示工作目录
- WebUI：hono JSX renderer 单文档页面（全内联，零外部引用）
- serve 脚本：`npm run serve -- --workdir/-H/-p` 实测（自动初始化、指定端口、health 正常）
