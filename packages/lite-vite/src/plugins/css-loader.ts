import { log } from "@lite-vite/shared";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "css-loader",
  async transform(content, filePath, options) {
    const { isModuleRequest } = options || {};
    const fileRegex = /\.css$/i;

    // 添加调试日志
    log.debug(
      `CSS 文件判断: ${filePath}, 是否匹配: ${fileRegex.test(filePath)}`
    );

    if (!fileRegex.test(filePath) || typeof content !== "string") return null;

    // 增强调试日志
    log.debug(
      `CSS 加载器处理: ${filePath}, 模块请求: ${isModuleRequest}, 内容长度: ${content.length}`
    );

    if (isModuleRequest) {
      // 参考 Vite 官方源码的转换方式
      // 统一使用正斜杠，确保跨平台一致性
      const normalizedPath = filePath.replace(/\\/g, "/");
      const cssId = JSON.stringify(normalizedPath);
      const cssContent = JSON.stringify(content);
      const cssPath = JSON.stringify(`/${normalizedPath}`);

      log.debug(`转换 CSS 模块: ${normalizedPath}, ID: ${cssId}`);

      const code = `
        import { updateStyle, removeStyle, createHotContext } from "/@vite/client";

        // 创建热更新上下文
        import.meta.hot = createHotContext(${cssPath});

        // 定义 CSS 内容的唯一标识和内容
        const id = ${cssId};
        const css = ${cssContent};
        const modulePath = ${cssPath};

        // 注入样式到页面，并传递模块路径
        updateStyle(id, css, modulePath);

        // 启用热更新
        import.meta.hot.accept();

        // 在模块被移除时清理样式
        import.meta.hot.prune(() => {
          console.log("执行 CSS 模块的 prune 回调：" + modulePath);
          removeStyle(id);
        });

        export default css;
      `;

      return {
        code,
        mimeType: "application/javascript",
        map: null,
      };
    }

    // 对于直接请求的 CSS 文件，返回普通 CSS
    return {
      code: content,
      mimeType: "text/css",
      map: null,
    };
  },
};

export default plugin;
