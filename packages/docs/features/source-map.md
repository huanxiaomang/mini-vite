# Source Map

Source Map 建立了源代码与转换后代码之间的映射关系，让你能在浏览器 DevTools 中直接调试原始源文件。

## 开发阶段

### 自动生成

在开发阶段，以下文件类型会自动生成 **inline source map**（嵌入在代码中）：

| 文件类型 | Source Map 来源 |
|---|---|
| `.ts` / `.tsx` | esbuild 转译时生成 |
| `.vue` | `@vue/compiler-sfc` 编译时生成 |

### Inline Source Map

开发阶段的 Source Map 以 Base64 编码嵌入在文件末尾：

```js
// 转换后的代码...
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJ...
```

这种方式避免了额外的文件请求，适合开发阶段使用。

### 在 DevTools 中使用

1. 打开浏览器 DevTools（F12）
2. 切换到 Sources 面板
3. 在左侧文件树中找到原始源文件
4. 可以直接在源文件中设置断点、单步调试

## 生产构建

### 开启方式

生产构建默认**不生成** Source Map。可以通过以下方式开启：

**配置文件：**

```ts
export default defineLiteConfig({
  build: {
    sourcemap: true
  }
})
```

**顶层快捷配置：**

```ts
export default defineLiteConfig({
  sourcemap: true
})
```

**CLI 参数：**

```bash
lite-vite build -s
lite-vite build --sourcemap
```

### 输出格式

生产构建时，Source Map 以独立的 `.map` 文件输出：

```
dist/
├── main.js
├── main.js.map       # Source Map 文件
└── index.html
```

## 安全注意事项

::: warning
Source Map 文件包含完整的源码映射信息，可能暴露你的源代码逻辑。
:::

### 生产环境建议

1. **不要将 `.map` 文件部署到公网 CDN** —— 或通过服务器配置限制 `.map` 文件的访问
2. **仅供内部调试使用** —— 可以上传到错误监控平台（如 Sentry）用于线上错误定位
3. **Nginx 限制访问示例：**

```nginx
location ~* \.map$ {
  deny all;
  return 404;
}
```

### 构建报告提示

如果生产产物中包含 Source Map 文件，[构建分析报告](/features/build-report)会自动提示：

> Sourcemap 已包含在产物中，请确保不要将其公开部署到 CDN。
