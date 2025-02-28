import { rewriteImports } from "../imports";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "js-loader",
  async transform(content, filePath) {
    const fileRegex = /\.(js)$/;
    if (!fileRegex.test(filePath) || typeof content !== "string") return null;

    const code = await rewriteImports(content, filePath);

    return {
      code,
      mimeType: "application/javascript",
      map: null,
    };
  },
};

export default plugin;
