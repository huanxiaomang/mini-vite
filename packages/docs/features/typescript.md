# TypeScript 支持

Lite Vite 开箱即用地支持 TypeScript，无需安装任何额外的 loader 或 babel 预设。

## 开发阶段

### esbuild 即时转译

开发阶段使用 **esbuild** 对 TypeScript 文件进行即时转译。esbuild 是用 Go 编写的极速编译工具，TS → JS 的转换速度比 `tsc` 快 20-30 倍。

```
浏览器请求 /src/main.ts
  ↓
esbuild 将 TS 转为 JS (毫秒级)
  ↓
重写 import 路径
  ↓
返回 JS 内容 (Content-Type: application/javascript)
```

### 转译配置

esbuild 转译使用以下配置：

| 选项 | 值 | 说明 |
|---|---|---|
| `loader` | `'ts'` / `'tsx'` | 根据文件扩展名自动选择 |
| `target` | `'esnext'` | 编译目标：最新 ES 标准 |
| `format` | `'esm'` | 输出 ES Module 格式 |
| `sourcemap` | `'inline'` | 生成内联 Source Map |

### 不做类型检查

esbuild **仅做语法转换**，不进行 TypeScript 类型检查。这是保持极速转译的关键——类型检查通常是编译过程中最耗时的步骤。

::: tip 推荐做法
将类型检查交给以下工具：

- **IDE** —— VS Code 的 TypeScript 语言服务提供实时类型检查
- **CI/CD** —— 在持续集成中运行 `tsc --noEmit`
- **Git hooks** —— 在 pre-commit 中运行类型检查

```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```
:::

### 支持的文件类型

| 扩展名 | 说明 |
|---|---|
| `.ts` | TypeScript 源文件 |
| `.tsx` | TypeScript + JSX（使用 `tsx` loader） |

## 生产构建

生产构建使用 `rollup-plugin-typescript2` 进行完整的 TypeScript 编译。

### tsconfig.json 自动检测

如果项目根目录存在 `tsconfig.json`，构建时会自动启用 TypeScript 插件。如果不存在，TypeScript 文件将跳过类型编译，直接由其他插件处理。

### 构建配置

`rollup-plugin-typescript2` 默认关闭了类型检查（`check: false`），以加快构建速度。如果需要在构建时进行类型检查，建议单独运行 `tsc --noEmit`。

## 与 webpack 的对比

| 维度 | webpack | Lite Vite |
|---|---|---|
| 所需依赖 | `ts-loader` 或 `babel-loader` + `@babel/preset-typescript` | **零依赖**，内置支持 |
| 配置 | 需要在 `module.rules` 中配置 loader | 无需配置 |
| 编译速度 | `ts-loader` 较慢，`babel` 需要额外配置 | esbuild 极速转译 |
| 类型检查 | `ts-loader` 默认检查（可关闭）| 不检查（推荐 IDE 检查） |
| HMR | 需要额外配置 | 自动支持 |

## 最佳实践

### 推荐的 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

### 类型声明

如果需要在 TypeScript 中引入非 TS 文件，创建类型声明文件：

```ts
// src/vite-env.d.ts
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.css' {
  const css: string
  export default css
}
```
