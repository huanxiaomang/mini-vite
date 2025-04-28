import { rewriteImports } from "../imports";
import type { PluginOption } from "../type";

/**
 * JS 加载器插件 - 简单处理 JavaScript 文件
 */
const plugin: PluginOption = {
  name: "js-loader",
  async transform(content, filePath) {
    // 处理 JS 文件
    const fileRegex = /\.(m?js|jsx)$/;
    if (!fileRegex.test(filePath) || typeof content !== "string") {
      return null;
    }

    // 重写导入路径
    const codeWithImports = await rewriteImports(content, filePath);

    return {
      code: codeWithImports,
      mimeType: "application/javascript",
      map: null,
    };
  },
};

export default plugin;
