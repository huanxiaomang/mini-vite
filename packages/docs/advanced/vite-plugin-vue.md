# vite-plugin-vue 原理

本文深入剖析 Vue 单文件组件（SFC）在构建工具中的编译流程与 HMR 机制。这是理解 Vue 开发体验的核心——为什么改一行代码，浏览器就能精准地只更新那个组件？

## 编译流程：transformMain

`vite-plugin-vue` 的核心是 `transformMain` 函数，它将 `.vue` 文件转换为浏览器可执行的 JavaScript。

### 整体流程

```
App.vue
  │
  ├─ 1. @vue/compiler-sfc 的 parse() 解析
  │     → 生成 descriptor（包含 template / script / style 块）
  │
  ├─ 2. compileScript() 编译 <script> 块
  │     → 处理 <script setup>，提取组件选项
  │
  ├─ 3. compileTemplate() 编译 <template> 块
  │     → 模板转为 render 渲染函数
  │
  ├─ 4. compileStyle() 编译 <style> 块
  │     → 处理 scoped，添加 data-v-xxx 属性
  │
  ├─ 5. 缓存 descriptor（用于下次 HMR 对比）
  │
  ├─ 6. 注入 HMR 代码
  │
  └─ 7. 输出最终 JavaScript 模块
```

### descriptor 缓存

每次编译后，`descriptor`（SFC 的解析结果）会被**缓存**起来。当文件再次变更时，拿**新 descriptor 与旧 descriptor 对比**，精确判断哪个部分发生了变化，从而决定是 rerender 还是 reload。

### HMR 代码注入

编译后的 Vue 模块会被自动注入以下 HMR 相关代码：

```js
// ① 调用 Vue HMR 运行时，注册当前组件
__VUE_HMR_RUNTIME__.createRecord(__sfc_main__.__hmrId, __sfc_main__)

// ② 监听 file-changed 事件，标记当前正在变更的文件
import.meta.hot.on('file-changed', () => {
  __VUE_HMR_RUNTIME__.CHANGED_FILE = '/src/App.vue'  // 当前模块的路径
})

// ③ 导出 _rerender_only 标记
// 关键：判断变更是否来自 .vue 文件自身
export const _rerender_only =
  __VUE_HMR_RUNTIME__.CHANGED_FILE === '/src/App.vue'

// ④ 自接受，成为 HMR 边界
import.meta.hot.accept((mod) => {
  if (mod._rerender_only) {
    // 仅模板变化 → rerender（运行时 diff，保留状态）
    __VUE_HMR_RUNTIME__.rerender(mod.__hmrId, mod.render)
  } else {
    // script 变化或其他 → reload（完整重建组件）
    __VUE_HMR_RUNTIME__.reload(mod.__hmrId, mod)
  }
})
```

此时这个转换后的 JS 文件是**自接受的**——`.vue` 文件天然就是 HMR 边界。

---

## HMR 变更判定

当 `.vue` 文件发生变更时，插件需要精确判断变化发生在哪个部分，从而选择最优的更新策略。

核心维护两个变量：

- **`needRerender`** —— 是否需要重新渲染（保留组件状态）
- **`needReload`** —— 是否需要完全重载（组件状态丢失）

### template 变更判定

```
新旧 descriptor.template 对比
  │
  ├─ template 内容变化 (changed)
  │     → shouldRerender = true
  │
  └─ 触发了 shouldForceReload 的场景
        → shouldReload = true
```

::: info shouldForceReload 是什么？
Vue 3.2+ 引入了**自动剔除未使用的 import** 优化——template 中引用的组件会被自动收集到编译产物中。当 template 变化导致引用的组件列表变化时（比如删掉了一个 `<MyComp/>`），仅 rerender 无法正确处理 import 变化，必须 reload。
:::

### script 变更判定

```
新旧 descriptor.script / descriptor.scriptSetup 对比
  │
  ├─ !isEqualBlock() 且 !isEqualAst()
  │     → changed = true → shouldReload = true
  │
  └─ block 相同或 AST 相同
        → 无变化
```

对 `<script>` 和 `<script setup>` 两个块分别检查。使用两级判断：

1. **isEqualBlock()** —— 快速比较块的字符串内容
2. **isEqualAst()** —— 如果字符串不同（可能只是空白/注释变化），进一步比较 AST

#### `_rerender_only` 的关键作用

这里有一个**非常微妙的问题**：

假设 `App.vue` 导入了 `utils.ts`，当 `utils.ts` 变更时：

```
utils.ts (变更)
  ↑ importers
App.vue (HMR 边界，自接受)
```

更新传播到 `App.vue`，触发其 `accept` 回调。但此时 `App.vue` 自身的 script 并没有变化！如果单纯比较 descriptor 会发现 script 没变，走 rerender 路径——结果 `utils.ts` 的新代码根本没生效。

**解决方案就是 `_rerender_only` 判断**：

```js
export const _rerender_only =
  __VUE_HMR_RUNTIME__.CHANGED_FILE === '/src/App.vue'
```

- 如果变更的文件是 `.vue` 文件自身 → `CHANGED_FILE` 匹配 → `_rerender_only = true` → 可以走 rerender
- 如果变更的文件是其他 JS 依赖 → `CHANGED_FILE` 不匹配 → `_rerender_only = false` → **一律 reload**

这保证了：**只有 Vue 文件自身的 template 变化才走 rerender，其他一切情况都 reload**。

### style 变更判定

`descriptor.styles` 是一个**数组**（一个 `.vue` 文件可以有多个 `<style>` 块）：

```
逐个对比新旧 styles 数组
  │
  ├─ 某个 style block 内容变化 (changed)
  │     → 该 CSS 模块加入 affectedModules
  │     → 客户端重新请求该 CSS 的 URL（带 ?t=timestamp）
  │     → 【不触发组件 reload】
  │
  ├─ style block 数量增减（新增或删除了 <style> 块）
  │     → shouldReload = true
  │
  └─ scoped 属性变化（加上或去掉了 scoped）
        → shouldReload = true
```

style 内容变化的处理最优雅——直接走 CSS HMR 的通道（`updateStyle`），组件完全不需要 reload/rerender。

### 最终决策

```
if (shouldReload) {
  // 去掉 _rerender_only 导出，强制 reload
  // accept 回调中 mod._rerender_only === undefined → reload
} else if (shouldRerender) {
  // 保留 _rerender_only 导出
  // accept 回调中 mod._rerender_only === true → rerender
}
```

当不需要 rerender 时，插件会从输出中**去掉** `export const _rerender_only = ...` 这行代码，这样 `mod._rerender_only` 就是 `undefined`（falsy），`accept` 回调自然走 reload 分支。

---

## 完整 HMR 流程示例

### 场景 1：修改 template

```
App.vue 的 <template> 变化
  │
  ├─ Server: 对比 descriptor → template changed → shouldRerender
  ├─ Server: 保留 _rerender_only 导出
  ├─ Server: 发送 js-update，边界 = App.vue
  │
  ├─ Client: 重新 import App.vue?t=xxx
  ├─ Client: mod._rerender_only === true
  └─ Client: __VUE_HMR_RUNTIME__.rerender(id, mod.render)
             → Vue 运行时 diff 新旧 render 函数
             → 只更新 DOM 差异部分
             → 组件状态完全保留 ✅
```

### 场景 2：修改 script

```
App.vue 的 <script setup> 变化
  │
  ├─ Server: 对比 descriptor → script changed → shouldReload
  ├─ Server: 去掉 _rerender_only 导出
  ├─ Server: 发送 js-update，边界 = App.vue
  │
  ├─ Client: 重新 import App.vue?t=xxx
  ├─ Client: mod._rerender_only === undefined (falsy)
  └─ Client: __VUE_HMR_RUNTIME__.reload(id, mod)
             → 完全重建组件实例
             → 组件状态重置 ⚠️
```

### 场景 3：修改 style 内容

```
App.vue 的 <style scoped> 内容变化
  │
  ├─ Server: 对比 descriptor → style block 内容 changed
  ├─ Server: 将 CSS 模块加入 affectedModules
  ├─ Server: 发送 css-update
  │
  ├─ Client: 重新请求 CSS URL
  └─ Client: updateStyle 替换 <style> 内容
             → 组件完全不受影响 ✅
             → 零开销样式热替换
```

### 场景 4：依赖的 JS 文件变更

```
utils.ts (被 App.vue import) 变更
  │
  ├─ Server: propagateUpdate → 找到边界 App.vue
  ├─ Server: 链失活 → 清除 utils.ts 缓存
  ├─ Server: 发送 js-update，边界 = App.vue
  │
  ├─ Client: 重新 import App.vue?t=xxx
  ├─ Client: CHANGED_FILE = '/src/utils.ts' ≠ '/src/App.vue'
  ├─ Client: mod._rerender_only === false
  └─ Client: __VUE_HMR_RUNTIME__.reload(id, mod)
             → 完全重建，确保新的 utils.ts 代码生效 ✅
```

### 场景 5：增删 style block

```
App.vue 新增了一个 <style> 块
  │
  ├─ Server: style 数组长度变化 → shouldReload
  ├─ Server: 去掉 _rerender_only
  └─ Client: reload → 组件完整重建
```

---

## rerender vs reload

| | rerender | reload |
|---|---|---|
| **触发条件** | 仅 template 变化 | script 变化 / 依赖变化 / 强制 reload |
| **执行方式** | Vue HMR 运行时对比新旧 render 函数，diff 更新 DOM | 完全销毁旧组件实例，重新创建 |
| **组件状态** | ✅ **完全保留**（ref、reactive 等状态不变） | ❌ **重置**（组件从头开始） |
| **性能** | 快（只更新差异 DOM） | 较慢（完整组件生命周期） |
| **适用场景** | 调整样式、修改模板结构 | 修改逻辑、修改 props 定义 |

---

## 与其他框架的对比

### React (React Refresh)

React 的 HMR 通过 **React Refresh** 实现：

- 组件函数**一定会被重新执行**
- 状态通过 React Refresh 的运行时 hook 保留
- 没有 rerender/reload 的区分——始终是同一种更新方式

### Vue JSX

Vue 中使用 JSX 编写的组件**无法保留组件状态**：

- JSX 组件没有 `.vue` 文件的 descriptor 对比机制
- 修改 JSX 组件会直接**卸载旧组件，挂载新组件**
- 这是 Vue JSX 相比 SFC 在 DX 上的一个劣势

---

## 总结

vite-plugin-vue 的 HMR 精髓在于：

1. **descriptor 缓存对比** —— 精确判断 template/script/style 哪个部分变了
2. **`_rerender_only` 机制** —— 区分 "vue 文件自身变化" 和 "依赖的 JS 变化"
3. **三种更新粒度** —— style 走 CSS 热替换、template 走 rerender、其余走 reload
4. **自接受边界** —— `.vue` 文件天然是 HMR 边界，更新不向上传播

这套机制使得 Vue SFC 的开发体验极为流畅——修改模板即时生效且保留状态，修改样式零开销替换，只有修改逻辑时才需要组件 reload。
