import { hmrClientScript } from "../hmr";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "transform-html",
  async transform(content, filePath, { port }) {
    const fileRegex = /\.(html)$/;
    if (!fileRegex.test(filePath) || typeof content !== "string") return null;

    const code = `${content}\n${hmrClientScript(port)}`;

    return {
      code,
      mimeType: "text/html",
      map: null,
    };
  },
};

export default plugin;
