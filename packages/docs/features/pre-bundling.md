# 依赖预打包

Lite Vite 使用 esbuild 对第三方依赖进行自动预打包，确保浏览器可以高效加载 npm 包。

## 为什么需要预打包

### 问题一：格式不兼容

大多数 npm 包以 **CommonJS** 格式发布（使用 `require` / `module.exports`），而浏览器的原生 ESM 只能理解 `import` / `export` 语法。预打包将 CJS 依赖转换为浏览器可用的 ESM 格式。

### 问题二：HTTP 瀑布流

某些包（如 `lodash-es`）由数百个子模块组成。如果浏览器逐一请求每个子模块，会产生大量 HTTP 请求（瀑布流效应），严重影响页面加载速度。预打包将这些子模块合并为一个文件，一次请求即可获取。

### 与 webpack 方案的对比

| 维度 | webpack DLL Plugin | Lite Vite 预打包 |
|---|---|---|
| 配置 | 需要手动编写 DLL 配置文件 | **全自动**，零配置 |
| 构建速度 | 使用 webpack 打包，较慢 | 使用 esbuild，**极快** |
| 触发时机 | 手动运行 | 首次 import 时自动触发 |
| 缓存 | 需要手动管理 | 自动缓存和加载 |

## 工作流程

```
代码中 import 裸模块
  ↓
检查缓存 (node_modules/.lite-vite/)
  ↓ (缓存命中)       ↓ (缓存未命中)
直接返回             esbuild 预打包
                        ↓
                    写入缓存文件
                        ↓
                    更新 metadata.json
                        ↓
                    返回预打包结果
```

### 具体步骤

1. **识别裸模块** —— 当代码中出现 `import xxx from 'package-name'` 这样的非相对路径导入时，识别为第三方依赖
2. **检查缓存** —— 查看 `node_modules/.lite-vite/` 目录下是否已有该包的预打包结果
3. **执行预打包** —— 如果缓存未命中，使用 esbuild 将该包打包为单个 ESM 文件
4. **保存缓存** —— 将结果写入缓存目录，并更新 `metadata.json`
5. **重写导入** —— 将源代码中的裸模块导入重写为缓存文件路径

## esbuild 预打包配置

预打包使用以下 esbuild 配置：

| 选项 | 值 | 说明 |
|---|---|---|
| `bundle` | `true` | 打包所有依赖 |
| `format` | `'esm'` | 输出 ES Module 格式 |
| `platform` | `'browser'` | 面向浏览器环境 |
| `logLevel` | `'silent'` | 静默日志 |

对于 Vue 相关的包，还会注入以下 define 常量：

```ts
{
  __VUE_OPTIONS_API__: 'true',
  __VUE_PROD_DEVTOOLS__: 'false',
  __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
}
```

## 缓存机制

### 缓存目录

预打包结果存储在 `node_modules/.lite-vite/` 目录下：

```
node_modules/.lite-vite/
├── vue.js              # vue 的预打包结果
├── lodash-es.js        # lodash-es 的预打包结果
└── metadata.json       # 依赖映射表
```

### metadata.json

```json
{
  "dependencies": {
    "vue": "/path/to/node_modules/.lite-vite/vue.js",
    "lodash-es": "/path/to/node_modules/.lite-vite/lodash-es.js"
  }
}
```

### 缓存加载

开发服务器启动时会自动读取 `metadata.json`，恢复缓存映射。后续的导入请求直接从缓存返回，无需重新预打包。

### 清除缓存

当遇到依赖相关的异常时，可以手动清除缓存：

```bash
# 删除缓存目录
rm -rf node_modules/.lite-vite

# 重新启动开发服务器（会自动重新预打包）
pnpm dev
```

## 示例

### 导入路径重写

```js
// 源代码
import { createApp } from 'vue'
import { debounce } from 'lodash-es'

// 开发阶段实际请求的路径
import { createApp } from '/node_modules/.lite-vite/vue.js'
import { debounce } from '/node_modules/.lite-vite/lodash-es.js'
```

这个重写过程对开发者完全透明，无需关心具体路径。

## 注意事项

- 预打包只在**开发阶段**执行，生产构建由 Rollup 处理依赖
- 第一次启动或缓存清除后，首次访问可能会稍慢（esbuild 正在预打包），后续访问直接使用缓存
- 如果安装了新的依赖包，首次 import 时会自动触发预打包
