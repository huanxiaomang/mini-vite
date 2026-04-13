# HMR 完整原理

本文从 Server 端和 Client 端两个维度，深入剖析 HMR（热模块替换）的完整工作机制。

## 架构总览

```
┌─────────────────────────────────┐
│            Browser              │
│                                 │
│   index.html                    │
│     └─ <script type="module">   │
│           └─ main.ts            │
│               ├─ App.vue        │
│               ├─ style.css      │
│               └─ utils.ts       │
│                                 │
│   HMR Client (/@vite/client)    │
│     ├─ WebSocket 连接            │
│     ├─ 样式更新 (updateStyle)    │
│     └─ 模块重载 (import ?t=xxx) │
└──────────────┬──────────────────┘
               │ WebSocket / HTTP
┌──────────────┴──────────────────┐
│          Dev Server             │
│                                 │
│   HTTP 拦截 & 转换              │
│     ├─ HTML → 注入 HMR 脚本     │
│     ├─ JS/TS → rewriteImports  │
│     ├─ CSS → 转 JS 模块         │
│     ├─ Vue → compiler-sfc 编译  │
│     └─ 图片 → export default    │
│                                 │
│   模块依赖图 (Module Graph)      │
│   chokidar 文件监听              │
│   WebSocket 推送                 │
└─────────────────────────────────┘
```

---

## Server 端

### 请求拦截与转换

浏览器每一次 `import` 都是一次 HTTP 请求。Dev Server 拦截所有请求，按文件类型进行不同的转换处理。

#### JS 源码处理

源码文件（项目 `src/` 下的文件）经过两步处理：

1. **rewriteImports** —— 重写导入路径
   - 裸模块（`'vue'`）→ 预打包路径（`/node_modules/.lite-vite/vue.js`）
   - 省略扩展名 → 尝试补全（`.js` / `.ts` / `.jsx` / `.tsx`）
   - 相对路径 → 规范化为绝对路径

2. **HTTP 缓存策略**
   ```
   源码文件:  Cache-Control: no-cache（协商缓存，每次验证）
   依赖文件:  Cache-Control: max-age=31536000,immutable（强缓存一年）
   ```

   依赖文件经过预打包后内容不会变化（路径包含 hash），所以可以设置强缓存。源码文件随时可能被开发者修改，使用协商缓存。

#### 依赖处理

第三方依赖经过 esbuild 预打包：

1. **扫描** —— esbuild 扫描所有裸模块导入，解析依赖关系
2. **打包** —— 将 CJS 转 ESM，合并零散子模块为单文件
3. **Hash 编码** —— 基于依赖内容生成 hash，作为缓存键
4. **修改导入路径** —— 将源码中的裸模块路径重写为预打包后的路径

#### CSS 处理

CSS 被转换为**自接受的 JS 模块**：

```js
// 服务端转换 style.css 后返回的内容
import { updateStyle, removeStyle, createHotContext } from '/@vite/client'

import.meta.hot = createHotContext('/src/style.css')

const __vite__id = '/path/to/style.css'
const __vite__css = '.title { color: red; }'

// 注入样式
updateStyle(__vite__id, __vite__css)

// 自我接受——CSS 模块本身就是 HMR 边界
import.meta.hot.accept()

// 模块被移除时清理样式
import.meta.hot.prune(() => removeStyle(__vite__id))
```

关键点：CSS 模块天然是**自接受**的（`import.meta.hot.accept()`），所以 CSS 变更不会向上传播，直接在原地更新。

#### 静态资源处理

- **import 形式引入**：`import logo from './logo.png'` → 服务端添加 `?import` 标记，返回 `export default "/src/logo.png"`
- **src 属性直接引用**：不需要处理，浏览器直接请求，服务器返回原始文件（`public/` 下的资源通过静态文件服务拦截）

---

### 模块依赖图 (Module Graph)

模块依赖图是 HMR 系统的核心数据结构——一个**有向图**。

#### 数据结构

```ts
interface ModuleNode {
  url: string                      // 浏览器请求的 URL
  file: string                     // 文件系统绝对路径
  code: string | null              // 模块源代码
  lastUpdated: number              // 上次更新时间戳
  importers: Set<ModuleNode>       // 谁导入了我（父模块）
  importedModules: Set<ModuleNode> // 我导入了谁（子模块）
  isSelfAccepting: boolean         // 是否定义了 import.meta.hot.accept()
  acceptedHmrDeps: Set<string>     // 接受哪些依赖的更新
}
```

维护两个映射表实现快速查找：

```ts
class ModuleGraph {
  private urlToModuleMap = new Map<string, ModuleNode>()
  private fileToModuleMap = new Map<string, ModuleNode>()
}
```

#### 图的构建

每次浏览器请求一个模块时：

1. **注册模块** —— `ensureEntryFromUrl(url, file)` 创建或获取 ModuleNode
2. **分析导入** —— `es-module-lexer` 解析代码中的 `import` 语句
3. **建立双向链接** —— 对每个相对路径导入：
   ```
   当前模块.importedModules.add(被导入模块)
   被导入模块.importers.add(当前模块)
   ```
4. **检测 HMR 标记** —— 代码中是否包含 `import.meta.hot.accept` → 设置 `isSelfAccepting`

#### 外部模块过滤

`node_modules` 中的模块不加入依赖图（创建临时节点但不存储），因为：
- 第三方依赖由预打包处理，有独立的缓存机制
- 不需要对其进行 HMR 追踪

---

### HMR 更新传播：链失活机制

**这是 HMR 最核心的算法。** 以 `a.js → b.js → c.js` 为例（`a` 导入 `b`，`b` 导入 `c`）：

#### 第 1 步：文件变更检测

chokidar 监听到 `c.js` 发生变更。

#### 第 2 步：向上传播 (propagateUpdate)

从变更模块 `c.js` 出发，沿 `importers` 链**向上**进行 BFS 遍历：

```
c.js (变更)
  ↑ importers
b.js
  ↑ importers
a.js (定义了 import.meta.hot.accept() → 自接受)
```

#### 第 3 步：寻找 HMR 边界

**HMR 边界**是定义了 `import.meta.hot.accept()` 的模块，或父模块通过 `import.meta.hot.acceptDeps()` 接受子模块更新的节点。

遍历过程中：

- 如果当前模块是自接受模块 → **找到边界**，停止该分支
- 如果当前模块无 importers（到达根节点）且未找到边界 → 需要 full-reload
- 如果遇到**循环引用**或 HMR 处理链断裂 → 直接发送 `full-reload`，客户端全刷，`return`

#### 第 4 步：链失活 (Invalidate Chain)

找到 HMR 边界（如 `a.js`）后，**将变更模块与最近 HMR 边界之间的所有模块缓存失效**：

```
a.js (边界)  ←  b.js  ←  c.js (变更)
                 ↑          ↑
              失效缓存    失效缓存
```

即 `b.js` 和 `c.js` 的缓存都被清除。

::: tip 为什么链失活是必要的？
客户端重新 `import` 边界模块时，会给 URL 加上 `?t=timestamp`，这已经能让浏览器重新请求获取新代码。但**链失活这一步仍然必须做**，原因是：

1. **防止内存泄漏** —— 旧的模块对象如果不被清理，会一直驻留在内存中
2. **缓存策略演进** —— 早期 Vite 使用 LRU 缓存机制，现在已经转变为「改了就删」的更简单策略，链失活就是执行这个"删"的动作
:::

#### 第 5 步：发送更新

服务端向客户端发送 WebSocket 消息：

```json
{
  "type": "update",
  "updates": [
    {
      "type": "js-update",
      "path": "/src/c.js",
      "acceptedPath": "/src/a.js",
      "timestamp": 1713012345678
    }
  ]
}
```

携带所有 HMR 边界模块的路径，客户端脚本会重新 `import` 它们。

#### 完整流程图

```
文件变更 (c.js)
  │
  ├─ 1. chokidar 检测到 change 事件
  │
  ├─ 2. propagateUpdate: 从 c.js 沿 importers 链向上 BFS
  │     c.js → b.js → a.js(边界)
  │
  ├─ 3. 找到 HMR 边界?
  │     ├─ YES → 收集所有边界模块
  │     └─ NO  → needFullReload = true
  │
  ├─ 4. 链失活: invalidateModules([b.js, c.js])
  │     清除 c→a 链上所有中间模块的缓存
  │
  └─ 5. WebSocket 发送:
        ├─ 有边界 → { type: "update", updates: [...边界模块] }
        └─ 无边界 → { type: "full-reload" }
```

---

## Client 端

浏览器侧的 HMR 客户端脚本（`/@vite/client`）负责接收更新指令并执行。

### 页面加载流程

```
浏览器请求 index.html
  ↓
服务端注入 HMR 客户端脚本:
  <script type="module">
    import hmrClient from "/@vite/client"
    hmrClient.init(port)
  </script>
  ↓
客户端建立 WebSocket 连接
  ↓
浏览器按 ESM 规范逐个请求模块
  ↓
每个模块请求都经过服务端转换后返回
```

### WebSocket 消息处理

客户端收到消息后根据 `type` 分发：

```ts
switch (payload.type) {
  case 'connected':    // 连接建立
  case 'update':       // CSS/JS 更新
  case 'full-reload':  // 全页面刷新
  case 'prune':        // 模块移除
  case 'error':        // 错误提示
}
```

### CSS 更新策略

CSS 的更新分两种场景：

#### 1. `<link>` 标签加载的 CSS

当 CSS 通过 `<link rel="stylesheet">` 加载时：

```
CSS 变更
  ↓
cloneNode 创建新的 <link> 元素（URL 加 ?t=timestamp）
  ↓
新 <link> onload 后 removeChild 旧 <link>
  ↓
完成替换
```

**为什么要 cloneNode 而不是直接修改 href？**
- 直接修改 href 会导致**FOUC（无样式闪烁）**——旧样式立即移除，新样式还在加载
- cloneNode 方式确保新样式加载完成后才移除旧样式，无缝切换

#### 2. JS 模块 import 的 CSS

当 CSS 通过 `import './style.css'` 引入时，走正常的 HMR 模块更新：

- **新增/更新**：调用 `updateStyle(id, css)` —— 查找或创建 `<style>` 元素，更新其 `textContent`
- **移除**：调用 `removeStyle(id)` —— 从 DOM 中移除对应的 `<style>` 元素

#### 为什么选择 `<style>` 标签方案？

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| `<link>` 标签 | 浏览器原生支持 | 每次更新要发异步请求，开销大，还要处理加载顺序 | ❌ |
| `CSSStyleSheet` API | 性能好 | 不能处理 `@import`，需要回退到 `<style>`，导致管理混乱 | ❌ |
| **`<style>` 标签** | 同步更新，无加载延迟 | 需要管理 `data-vite-style-id` | ✅ 采用 |

`<style>` 标签通过 `data-vite-style-id` 属性标识，实现精准的增删改：

```html
<style data-vite-style-id="/src/style.css">
  .title { color: red; }
</style>
```

### JS 更新策略

#### 1. 更新队列

JS 更新进入 `queueUpdate` **更新队列**，保证执行顺序：

```
收到多个 js-update
  ↓
queueUpdate 排队，从下至上的顺序执行
  ↓
保证依赖先于依赖者更新
```

#### 2. 通过 import + timestamp 重新加载

客户端通过动态 `import()` 加上时间戳参数重新加载模块：

```js
const newModule = await import(`/src/a.js?t=${timestamp}`)
```

浏览器看到 URL 不同（时间戳变了），会发起新的 HTTP 请求，服务端返回最新的转换结果。

---

## HMR 边界详解

### 什么是 HMR 边界

HMR 边界是定义了 `import.meta.hot.accept()` 的模块，或父模块通过 `import.meta.hot.accept(deps, callback)` 接受子模块更新的节点。

边界的本质含义是：**"我能够自行处理子模块的更新，不需要继续向上传播"**。

### 边界类型

| 类型 | 说明 | 示例 |
|---|---|---|
| 自接受模块 | 调用了 `import.meta.hot.accept()` 无参数 | CSS 模块、入口文件 |
| 依赖接受模块 | 调用了 `import.meta.hot.accept('./dep.js', cb)` | 手动管理依赖更新 |
| Vue 组件 | vite-plugin-vue 自动注入 accept | `.vue` 文件 |

### 无边界时的行为

如果 propagateUpdate 遍历到根模块都没找到边界：

```
c.js (变更) → b.js → a.js → (无 importers，到顶了)
                                   ↓
                              没有任何模块声明 accept
                                   ↓
                              full-reload 全页面刷新
```

这是最常见的 "HMR 不生效" 的原因——依赖链上没有任何模块声明自己能处理更新。

---

## 文件类型与更新策略汇总

| 文件类型 | 服务端处理 | 客户端更新策略 | 是否自接受 |
|---|---|---|---|
| **HTML** | 注入 HMR 脚本 | `full-reload` | N/A |
| **CSS** (import) | 转为 JS 模块，注入 updateStyle | `<style>` 内容替换 | ✅ 自动 |
| **CSS** (link) | 原样返回 | cloneNode 替换 `<link>` | N/A |
| **JS/TS** | rewriteImports | `import(?t=ts)` 重新加载 | 需手动声明 |
| **Vue SFC** | compiler-sfc 编译 | 组件级 rerender/reload | ✅ 自动（插件注入） |
| **图片** | export default 路径 | `full-reload` | ❌ |

---

## 调试技巧

### 服务端日志

开发服务器在 `debug` 日志级别下会输出完整的模块图和传播信息：

```bash
[DEBUG] 创建新模块: /src/main.ts -> /abs/path/src/main.ts
[DEBUG] 建立导入关系: /src/main.ts -> /src/App.vue
[DEBUG] 检测到自接受模块: /src/main.ts
[DEBUG] 开始处理更新传播: /abs/path/src/utils.ts
[DEBUG] 模块总数: 5
[DEBUG] 沿导入链传播: /src/utils.ts <- /src/main.ts
[DEBUG] 找到HMR边界: /src/main.ts, 自我接受: true
[DEBUG] 更新传播分析完成: 受影响模块 2 个, 边界 1 个, 不需要完全刷新
```

### 客户端日志

浏览器控制台中 HMR 客户端会输出带颜色的日志：

```
[vite-hmr] Connected to HMR server
[vite-hmr] Received HMR message: update
[vite-hmr] Processing 1 updates
[vite-hmr] Updating style: /src/style.css
```

### 常见问题排查

| 现象 | 可能原因 | 解决方案 |
|---|---|---|
| 每次修改都 full-reload | 依赖链上无 HMR 边界 | 在合适的模块添加 `import.meta.hot.accept()` |
| CSS 更新不生效 | CSS 不是通过 `import` 引入 | 改为 JS 中 `import './style.css'` |
| Vue 组件不热更新 | 组件编译出错 | 检查控制台 error 消息 |
| HMR 连接断开 | 服务器重启 | 客户端自动重连（1 秒间隔） |
