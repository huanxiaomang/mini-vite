# 为什么选择 Lite Vite

## 传统构建工具的痛点

以 webpack 为代表的传统构建工具在过去十年里推动了前端工程化的发展，但随着项目规模的增长，它们的先天架构缺陷愈发明显。

### 冷启动慢

webpack 必须在启动前完成以下步骤：

1. 从入口文件出发，递归解析整个依赖树
2. 将所有模块通过 loader 链进行转换
3. 将转换后的模块打包成 bundle
4. 生成开发服务器可用的产物

对于一个中大型项目（数千个模块），这个过程可能需要 **30 秒到数分钟**。每次启动开发都要经历漫长的等待。

### HMR 越来越慢

webpack 的热更新机制同样受限于打包架构：

- 文件变更后，需要重新遍历受影响的模块子树
- 重新对变更模块进行完整的 loader 链处理
- 重新打包生成更新 chunk
- 项目越大，单次热更新耗时越长，从毫秒级退化到秒级

### 配置地狱

一个典型的 webpack 项目需要手动安装和配置大量 loader 和 plugin：

```js
// webpack.config.js - 典型配置
module.exports = {
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader' },
      { test: /\.vue$/, use: 'vue-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.scss$/, use: ['style-loader', 'css-loader', 'sass-loader'] },
      { test: /\.(png|jpg|svg)$/, use: 'file-loader' },
      // ... 还有更多
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({ template: './index.html' }),
    new MiniCssExtractPlugin(),
    // ... 还有更多
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.vue'],
  },
  // ... devServer 配置、optimization 配置...
}
```

仅仅是让项目能运行，就需要几十行配置和十几个依赖包。

### 产物臃肿

webpack 的产物中包含了自己的**模块运行时**（`__webpack_require__`、`__webpack_modules__` 等），这些代码对最终用户毫无价值，却增加了产物体积。而且 webpack 的 tree-shaking 能力有限，常常无法完全消除未使用的代码。

## Lite Vite 如何解决

### 不打包的开发服务器

Lite Vite 彻底改变了开发阶段的工作方式：

```
传统方式 (webpack):
  源码 → 解析依赖 → loader 转换 → 打包 → 启动服务器 → 可访问
  (随项目增大，启动越慢)

Lite Vite 方式:
  源码 → 启动服务器 → 可访问 → 按需转换请求的模块
  (启动速度恒定)
```

浏览器通过原生 ESM 的 `import` 语句逐一请求模块，Lite Vite 只在请求到达时才对该模块进行编译转换。这意味着：

- **启动速度与项目大小无关**
- **只编译实际访问到的模块**，未访问的模块零开销

### 精准的热更新

Lite Vite 构建了**模块依赖图**（Module Graph），精确追踪模块间的导入关系。当文件变更时：

1. 通过依赖图定位**受影响的模块链**
2. 通过 BFS 算法找到最近的 **HMR 边界**
3. 只向浏览器发送精确的更新指令

更新范围被限制在最小必要区域，无论项目多大，热更新速度始终稳定。

### 零配置开箱即用

Lite Vite 内置了常用文件类型的处理支持：

| 文件类型 | webpack 方式 | Lite Vite 方式 |
|---|---|---|
| TypeScript | 安装配置 `ts-loader` 或 `babel-loader` + `@babel/preset-typescript` | **内置支持**，esbuild 即时转译 |
| Vue SFC | 安装配置 `vue-loader` + `VueLoaderPlugin` | **内置支持**，自动编译 |
| CSS | 安装配置 `css-loader` + `style-loader` | **内置支持**，自动注入 |
| 图片 | 安装配置 `file-loader` 或 `url-loader` | **内置支持**，SVG 内联 / 路径引用 |
| HTML | 安装配置 `html-webpack-plugin` | **内置支持**，自动解析入口 |

一个最简配置文件就能让项目跑起来：

```ts
// lite.config.ts
import { defineLiteConfig } from 'lite-vite'

export default defineLiteConfig({
  // 大部分场景下，零配置即可运行
})
```

### 更小的生产产物

Lite Vite 使用 Rollup 进行生产构建。Rollup 从设计之初就面向 ES Module，tree-shaking 能力远超 webpack：

- **无运行时开销** —— 产物中没有模块加载器的额外代码
- **更彻底的 tree-shaking** —— 基于 ESM 静态分析，精确消除无用代码
- **更灵活的输出** —— 支持 ESM 和 CJS 两种输出格式

## 对比总结

| 维度 | webpack | Lite Vite |
|---|---|---|
| 开发启动 | 需全量打包，项目越大越慢 | 即时启动，与项目大小无关 |
| 热更新 | 重新打包受影响的 chunk，渐慢 | 模块级精准更新，始终快速 |
| 配置复杂度 | 需大量 loader/plugin 配置 | 开箱即用，零配置可运行 |
| TS 编译 | ts-loader（慢）/ babel（需配置） | esbuild 即时转译（极快） |
| 生产产物 | 含模块运行时，tree-shaking 有限 | Rollup 打包，产物更精简 |
| 依赖处理 | DLL Plugin（手动配置） | 自动 esbuild 预打包 |
