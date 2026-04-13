# CSS 处理

Lite Vite 内置了完整的 CSS 处理支持，覆盖开发和生产两个阶段，无需像 webpack 那样安装 `css-loader` + `style-loader`。

## 基本用法

### 在 JS 中引入 CSS

```js
import './style.css'
```

CSS 文件会被转换为 JavaScript 模块，通过 `<style>` 标签动态注入到页面中。

### 在 HTML 中引入 CSS

```html
<link rel="stylesheet" href="/src/style.css">
```

直接通过 `<link>` 标签引入时，CSS 会原样返回。

## 开发阶段行为

### CSS 模块化注入

当 CSS 通过 JavaScript `import` 引入时（称为"模块请求"），Lite Vite 会将其转换为一个 JavaScript 模块：

```css
/* style.css */
.title { color: red; }
```

转换后的 JavaScript 模块大致如下：

```js
import { updateStyle, removeStyle, createHotContext } from '/@vite/client'

// 创建 HMR 上下文
import.meta.hot = createHotContext('/src/style.css')

const id = '/path/to/style.css'
const css = '.title { color: red; }'

// 注入样式到页面
updateStyle(id, css, '/src/style.css')

// 启用热更新
import.meta.hot.accept()

// 模块被移除时清理样式
import.meta.hot.prune(() => {
  removeStyle(id)
})

export default css
```

### 样式注入机制

每个 CSS 模块在页面中对应一个 `<style>` 元素：

- 通过 `data-module-path` 属性标识来源
- 通过唯一的 `id` 属性（`vite-css-{id}`）定位
- 插入到 `<head>` 元素中

```html
<head>
  <style id="vite-css-xxx" data-module-path="/src/style.css">
    .title { color: red; }
  </style>
</head>
```

### CSS 热更新

CSS 的热更新是最平滑的更新方式：

1. 修改 CSS 文件并保存
2. 服务端检测到变更，发送 `css-update` 消息
3. 客户端找到对应的 `<style>` 元素
4. 直接替换样式内容

**整个过程无刷新，页面状态完全保留**。不像 webpack 需要整个 CSS chunk 重新编译。

### CSS 删除处理

当不再引用某个 CSS 文件时：

1. 服务端发送 `prune` 消息
2. 客户端触发该 CSS 模块的 `prune` 回调
3. 对应的 `<style>` 元素从 DOM 中移除

## 生产构建行为

在生产构建阶段，CSS 文件通过 `rollup-plugin-postcss` 处理：

- CSS 文件被提取为独立的 `.css` 产物
- 支持 PostCSS 处理（自动前缀等）
- 支持 CSS 压缩

## 与 webpack 的对比

| 维度 | webpack | Lite Vite |
|---|---|---|
| 所需依赖 | `css-loader` + `style-loader`（+ `mini-css-extract-plugin`） | **零依赖**，内置支持 |
| 配置 | 需要在 `module.rules` 中配置 | 无需配置 |
| 开发热更新 | 需要 `style-loader` 的 HMR 支持 | 内置，自动工作 |
| 生产提取 | 需要 `mini-css-extract-plugin` | 内置，自动提取 |

## 注意事项

- CSS 文件在 JS 中 `import` 时会被转为 JS 模块，这会增加一个模块请求。但由于利用了浏览器缓存和 HMR，实际体验很好。
- `public/` 目录下的 CSS 文件不会经过模块化处理，始终作为静态文件直接服务。
