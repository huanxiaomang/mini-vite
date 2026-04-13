# 静态资源处理

Lite Vite 内置了对图片、SVG 等静态资源的处理支持，无需像 webpack 那样安装 `file-loader` 或 `url-loader`。

## 支持的资源类型

| 格式 | MIME 类型 | 模块导入行为 |
|---|---|---|
| `.svg` | `image/svg+xml` | 内联为 data URI |
| `.png` | `image/png` | 返回文件路径 |
| `.jpg` / `.jpeg` | `image/jpeg` | 返回文件路径 |

## 在 JavaScript 中引入

### 图片引用

```js
import logo from './assets/logo.png'

// logo 的值是图片的 URL 路径，如 "/src/assets/logo.png"
const img = document.createElement('img')
img.src = logo
document.body.appendChild(img)
```

### SVG 内联

SVG 文件会被编码为 data URI 字符串，直接嵌入到 JavaScript 中，无需额外的网络请求：

```js
import icon from './assets/icon.svg'

// icon 的值是 "data:image/svg+xml,..." 格式
const img = document.createElement('img')
img.src = icon
```

这对于小型图标非常高效——减少 HTTP 请求数，加快首屏渲染。

### 区分模块请求和直接请求

Lite Vite 自动区分两种请求方式：

```js
// 模块请求（通过 import）——返回 JavaScript 模块
import logo from './logo.png'
// → export default "/src/logo.png"

// 直接请求（浏览器直接访问 URL）——返回图片二进制数据
// GET /src/logo.png → 返回 PNG 图片
```

导入语句会自动添加 `?import` 查询参数来标记模块请求。

## public 目录

`public/` 目录下的文件会被作为静态资源直接提供，不经过任何处理。

### 开发阶段

通过开发服务器直接访问。例如 `public/favicon.svg` 可通过 `http://localhost:4000/favicon.svg` 访问。

### 生产构建

`public/` 目录的内容会被原样复制到输出目录：

```
public/                    dist/
├── favicon.svg     →     ├── favicon.svg
├── robots.txt      →     ├── robots.txt
└── images/         →     └── images/
    └── og.png                └── og.png
```

### 使用建议

适合放在 `public/` 目录的文件：

- `favicon.ico` / `favicon.svg`
- `robots.txt`
- `manifest.json`
- 不需要被 JavaScript 引用的图片

**不适合** 放在 `public/` 的文件：

- 需要通过 `import` 引入的资源（应放在 `src/assets/`）
- 需要经过编译转换的文件

## 在 HTML 中引用

```html
<!-- 引用 public/ 下的资源 -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />

<!-- 引用 src/ 下的资源 -->
<img src="/src/assets/logo.png" />
```

## 生产构建中的资源处理

生产构建使用 `@rollup/plugin-image` 处理图片资源：

- 支持 `.png`、`.jpg`、`.svg` 格式
- 图片内容通过 Rollup 的资源管道处理
- `public/` 目录的内容原样复制

## 与 webpack 的对比

| 维度 | webpack | Lite Vite |
|---|---|---|
| 所需依赖 | `file-loader` 或 `url-loader`（webpack 5 用 `asset/resource`） | **零依赖**，内置支持 |
| 配置 | 需要为每种格式配置 loader 规则 | 无需配置 |
| SVG 内联 | 需要 `url-loader` + 大小阈值配置 | SVG **默认内联** |
| 路径处理 | loader 处理后返回哈希文件名 | 开发阶段使用原始路径，构建阶段由 Rollup 处理 |
