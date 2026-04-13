# 纯 JS 模板

`vanilla-js-template` 是一个纯 JavaScript 项目模板，适合快速原型开发或不使用框架的场景。

## 创建项目

```bash
pnpm create lite-vite@latest
# 选择 vanilla-js-template
```

## 目录结构

```
vite-js-template/
├── public/
│   └── vite.svg              # 公共静态资源
├── src/
│   ├── assets/
│   │   └── 486.png           # 图片资源
│   ├── counter.js            # 计数器模块
│   ├── javascript.svg        # JS logo
│   ├── main.js               # 应用入口
│   ├── style.css             # 全局样式
│   └── vite.svg              # logo
├── index.html                # HTML 入口
├── package.json              # 项目配置
└── .gitignore
```

## package.json

```json
{
  "name": "vite-js-template",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "lite-vite dev",
    "build": "lite-vite build"
  },
  "devDependencies": {
    "lite-vite": "^2.0.0"
  }
}
```

## 入口文件

### index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lite Vite App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

### src/main.js

入口 JavaScript 文件，负责渲染页面内容和导入样式：

```js
import './style.css'
import viteLogo from './vite.svg'
import jsLogo from './javascript.svg'
import { setupCounter } from './counter.js'

// 渲染页面...
setupCounter(document.querySelector('#counter'))
```

## 命令

```bash
# 启动开发服务器
pnpm dev

# 构建生产产物
pnpm build
```

## 特点

- **零框架依赖** —— 纯原生 JavaScript，无 Vue/React 等框架
- **快速启动** —— 项目极简，启动秒级完成
- **支持 ES Module** —— 使用 `import/export` 语法
- **CSS 热更新** —— 修改样式即时生效
- **图片资源处理** —— SVG 内联、PNG 路径引用

## 适用场景

- 快速验证想法或原型开发
- 学习原生 JavaScript 开发
- 小型工具页面或 landing page
- 不需要框架的轻量项目
