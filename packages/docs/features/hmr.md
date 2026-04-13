# 热模块替换 (HMR)

热模块替换（Hot Module Replacement）是 Lite Vite 的核心功能之一，让你在修改代码后无需手动刷新浏览器就能看到更新效果，同时保留应用状态。

## 工作原理

### 整体流程

```
文件保存
  ↓
chokidar 检测到文件变更
  ↓
分析模块依赖图，确定受影响范围
  ↓
通过 WebSocket 向浏览器推送更新指令
  ↓
客户端根据指令类型执行更新
```

### 与 webpack HMR 的区别

| 维度 | webpack | Lite Vite |
|---|---|---|
| 更新粒度 | 重新编译受影响的 chunk | 模块级精准更新 |
| 更新速度 | 与项目大小成正比 | 始终保持毫秒级 |
| 传播分析 | 整个 chunk 链 | 基于模块依赖图的 BFS |

## 不同文件类型的 HMR 行为

### CSS 热更新

CSS 文件的热更新是最平滑的——修改样式后，浏览器会直接替换对应的 `<style>` 元素内容，无需刷新页面，应用状态完全保留。

```
CSS 文件变更 → 发送 css-update → 客户端替换 <style> 内容
```

### JavaScript / TypeScript 热更新

JS/TS 文件的热更新基于 **HMR 边界机制**：

1. 从变更文件出发，沿导入链向上遍历
2. 找到最近的**自接受模块**（调用了 `import.meta.hot.accept()` 的模块）作为 HMR 边界
3. 只重新加载边界模块及其依赖

如果找不到任何 HMR 边界，将回退到全页面刷新。

### Vue 组件热更新

`.vue` 文件变更会触发组件级热更新——仅重新编译和替换变更的组件，应用的其他部分和状态不受影响。

### HTML 热更新

HTML 文件是应用的根文档，其结构变更总是触发**全页面刷新**。

## HMR API

Lite Vite 通过 `import.meta.hot` 对象暴露 HMR API。

::: tip
`import.meta.hot` 仅在开发模式下存在，使用前应进行条件判断。
:::

### import.meta.hot.accept()

声明当前模块接受自身更新：

```js
// counter.js
let count = 0

export function increment() {
  count++
  render()
}

function render() {
  document.getElementById('count').textContent = count
}

// HMR 支持
if (import.meta.hot) {
  import.meta.hot.accept()
}
```

当 `counter.js` 被修改时，浏览器会重新执行该模块，而不是刷新整个页面。

### import.meta.hot.accept(deps, callback)

接受指定依赖的更新：

```js
// app.js
import { render } from './render.js'

render()

if (import.meta.hot) {
  // 当 render.js 变更时，重新执行回调
  import.meta.hot.accept('./render.js', (newModule) => {
    newModule.render()
  })
}
```

接受多个依赖：

```js
if (import.meta.hot) {
  import.meta.hot.accept(
    ['./moduleA.js', './moduleB.js'],
    ([newA, newB]) => {
      // 处理更新
    }
  )
}
```

### import.meta.hot.dispose(callback)

注册清理回调，在模块被替换**之前**调用：

```js
let timer = setInterval(() => console.log('tick'), 1000)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // 清理旧模块的副作用
    clearInterval(timer)
  })
  import.meta.hot.accept()
}
```

常见的清理场景：
- 清除定时器（`setInterval` / `setTimeout`）
- 移除事件监听器
- 断开 WebSocket 连接
- 清理 DOM 元素

### import.meta.hot.prune(callback)

注册回调，在模块从页面中**完全移除**时调用（不再被任何模块引用）：

```js
if (import.meta.hot) {
  import.meta.hot.prune(() => {
    // 模块被删除时的清理工作
    console.log('模块已被移除')
  })
}
```

CSS 模块的样式清理就利用了这个机制——当 CSS 文件不再被引用时，会自动移除对应的 `<style>` 元素。

### import.meta.hot.invalidate()

主动使当前模块失效，触发全页面刷新：

```js
if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (cannotHandleUpdate(module)) {
      // 无法增量更新，请求全页面刷新
      import.meta.hot.invalidate()
    }
  })
}
```

### import.meta.hot.data

在模块更新前后共享数据的持久化对象：

```js
if (import.meta.hot) {
  // 保存当前状态
  import.meta.hot.dispose((data) => {
    data.count = count
  })

  // 恢复状态
  import.meta.hot.accept()
  if (import.meta.hot.data.count !== undefined) {
    count = import.meta.hot.data.count
  }
}
```

### 自定义事件

```js
if (import.meta.hot) {
  // 监听自定义事件
  import.meta.hot.on('my-event', (payload) => {
    console.log('收到事件:', payload)
  })

  // 发送自定义事件
  import.meta.hot.send('my-event', { message: 'hello' })

  // 移除监听
  import.meta.hot.off('my-event', handler)
}
```

## 自动重连

当开发服务器重启或网络断开时，HMR 客户端会自动尝试重新连接。重连间隔为 1 秒，在连接恢复后会自动重新建立 HMR 通道。

## 错误处理

当 HMR 更新过程中发生错误时：

1. 服务端将错误信息通过 WebSocket 发送到客户端
2. 客户端在控制台显示详细的错误信息和堆栈
3. 不会导致应用崩溃——应用保持在上一个正常状态

## 常见问题

### HMR 不生效，每次都全页面刷新

这通常是因为变更的模块在依赖链上没有找到 HMR 边界。确保以下任一条件成立：

1. 变更的模块自身调用了 `import.meta.hot.accept()`
2. 依赖链上的某个父模块调用了 `import.meta.hot.accept()`
3. Vue 组件文件会自动成为 HMR 边界
4. CSS 模块会自动成为 HMR 边界

### 热更新后状态丢失

利用 `import.meta.hot.data` 在更新前后保存和恢复状态，或使用 `dispose` 钩子进行状态序列化。
