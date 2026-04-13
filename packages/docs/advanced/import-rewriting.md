# 导入路径重写机制

浏览器的原生 ESM 只能加载以 `/`、`./`、`../` 开头的路径。对于裸模块导入（如 `import { ref } from 'vue'`）和省略扩展名的路径，需要进行重写才能被浏览器正确解析。

## 重写流程

当一个 JS/TS 文件被请求时，Lite Vite 会对其中的 `import` 语句进行路径重写：

```
原始代码
  ↓
es-module-lexer 解析所有 import 语句
  ↓
逐个处理每个 import 的路径
  ↓
magic-string 执行路径替换
  ↓
返回重写后的代码
```

### 使用的工具

| 工具 | 作用 |
|---|---|
| **es-module-lexer** | 高性能的 ES Module 词法分析器，提取所有 import 语句的位置信息 |
| **magic-string** | 高效的字符串操作库，支持精准的子串替换而不影响其他位置 |

## 三种重写场景

### 1. 裸模块 → 预打包路径

```js
// 源代码
import { ref } from 'vue'
import { debounce } from 'lodash-es'

// 重写后
import { ref } from '/node_modules/.lite-vite/vue.js'
import { debounce } from '/node_modules/.lite-vite/lodash-es.js'
```

处理逻辑：

1. 判断导入路径不以 `./`、`../`、`/` 开头 → 识别为裸模块
2. 提取包名（取 `/` 前的第一段）
3. 检查预打包缓存
4. 如果缓存命中，替换为缓存文件路径
5. 如果缓存未命中，触发 esbuild 预打包，然后替换路径

### 2. 省略扩展名 → 补全扩展名

```js
// 源代码
import { hello } from './utils'

// 重写后（假设 utils.ts 存在）
import { hello } from '/src/utils.ts'
```

处理逻辑：

1. 判断导入路径没有扩展名
2. 按顺序尝试以下扩展名：`.js` → `.ts` → `.jsx` → `.tsx`
3. 检查带扩展名的文件是否存在
4. 找到第一个存在的文件，使用其规范化后的路径

### 3. 相对路径 → 绝对路径

```js
// 源代码（在 /src/components/App.vue 中）
import Header from './Header.vue'
import logo from '../assets/logo.png'

// 重写后
import Header from '/src/components/Header.vue'
import logo from '/src/assets/logo.png'
```

处理逻辑：

1. 使用 `path.resolve()` 将相对路径解析为绝对路径
2. 转为相对于项目根目录的路径
3. 添加 `/` 前缀使其成为服务器根路径

### 静态资源标记

非代码资源（CSS、图片）的导入会额外添加 `?import` 查询参数：

```js
// 源代码
import './style.css'
import logo from './logo.png'

// 重写后
import './style.css?import'
import logo from '/src/logo.png?import'
```

`?import` 标记告诉开发服务器"这是一个模块请求"，服务器会以 JavaScript 模块的形式返回内容（而不是原始的 CSS/图片数据）。

## 跳过的导入

以下类型的导入不会被重写：

- **HTTP URL** —— `import x from 'https://cdn.example.com/lib.js'`
- **外部模块**（在 Rollup externals 中配置的）

## 在构建阶段

生产构建时，导入路径由 Rollup 及其 `@rollup/plugin-node-resolve` 插件处理，使用标准的 Node.js 模块解析算法，不依赖 Lite Vite 的开发阶段重写逻辑。
