# Vue 单文件组件支持

Lite Vite 内置 Vue 3 单文件组件（SFC）的编译支持，无需像 webpack 那样安装 `vue-loader` + `VueLoaderPlugin`。

## 基本用法

直接在项目中创建 `.vue` 文件即可使用：

```vue
<!-- App.vue -->
<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <button @click="count++">点击次数: {{ count }}</button>
</template>

<style scoped>
button {
  padding: 8px 16px;
  font-size: 16px;
}
</style>
```

```ts
// main.ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

## 编译流程

Lite Vite 使用 `@vue/compiler-sfc`（Vue 官方编译器）处理 `.vue` 文件：

```
.vue 文件
  ↓
1. parse() — 解析为 descriptor（script/template/style 块）
  ↓
2. compileScript() — 编译 <script> 块
  ↓
3. compileTemplate() — 编译 <template> 为渲染函数
  ↓
4. compileStyle() — 编译 <style> 块（处理 scoped）
  ↓
5. 拼接输出 JavaScript 模块
```

### 输出结构

一个 `.vue` 文件最终被编译为以下形式的 JavaScript：

```js
// 编译后的 script（使用 rewriteDefault 重命名默认导出）
const __sfc_main__ = { /* 组件选项 */ }
__sfc_main__.__scopeId = 'data-v-xxxxxx'

// 编译后的 template 渲染函数
function render(_ctx, _cache) { /* ... */ }
__sfc_main__.render = render

export default __sfc_main__

// 编译后的 style（内联注入）
var el = document.createElement('style')
el.innerHTML = `button[data-v-xxxxxx] { padding: 8px 16px; }`
document.body.append(el)
```

## Script 支持

### `<script setup>`

完整支持 Vue 3 的 `<script setup>` 语法糖：

```vue
<script setup>
import { ref, computed } from 'vue'

const count = ref(0)
const double = computed(() => count.value * 2)

function increment() {
  count.value++
}
</script>
```

### 普通 `<script>`

也支持传统的 Options API 写法：

```vue
<script>
export default {
  data() {
    return { count: 0 }
  },
  methods: {
    increment() {
      this.count++
    }
  }
}
</script>
```

### 导入重写

`<script>` 块中的 `import` 语句会经过与普通 JS/TS 文件相同的导入路径重写处理：

- 裸模块 → 预打包路径
- 省略扩展名 → 自动补全
- 相对路径 → 规范化

## Template 支持

`<template>` 块通过 `compileTemplate()` 编译为渲染函数：

```vue
<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <p v-if="showDesc">{{ description }}</p>
  </div>
</template>
```

编译后生成高效的渲染函数代码，包含 Vue 3 的编译优化（如静态提升、patch flag 等）。

## Style 支持

### 普通样式

```vue
<style>
.container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
```

### Scoped 样式

使用 `scoped` 属性启用样式隔离：

```vue
<style scoped>
.title {
  color: red;
}
/* 编译后变为: .title[data-v-xxxxxx] { color: red; } */
</style>
```

每个组件的 scoped 样式会自动添加唯一的 `data-v-xxx` 属性选择器，确保样式仅作用于当前组件，不会污染其他组件。

### 多个 Style 块

一个 `.vue` 文件可以包含多个 `<style>` 块：

```vue
<style>
/* 全局样式 */
</style>

<style scoped>
/* 组件局部样式 */
</style>
```

所有 `<style>` 块都会被编译并通过 `<style>` 标签注入到页面中。

## 热更新

Vue 组件支持 HMR 热更新——修改 `.vue` 文件后，浏览器会重新编译并替换变更的组件，而不会刷新整个页面。

## 与 webpack 的对比

| 维度 | webpack | Lite Vite |
|---|---|---|
| 所需依赖 | `vue-loader` + `VueLoaderPlugin` | **零依赖**，内置支持 |
| 配置 | rules 配置 + plugin 注册 | 无需配置 |
| `<script setup>` | vue-loader 15+ 支持 | 原生支持 |
| Scoped CSS | vue-loader 处理 | 原生支持 |
| 编译速度 | 较慢（需走 loader 链） | 直接调用 compiler-sfc |
| HMR | 需要 vue-loader HMR 支持 | 内置支持 |

## 注意事项

- 确保项目安装了 `vue` 和 `@vue/compiler-sfc`（作为 peer dependency）
- 如果使用 TypeScript，建议在 `tsconfig.json` 中添加 `.vue` 文件的类型声明
- 样式通过内联 `<style>` 标签注入，在 SSR 场景中需要额外处理
