import { getMimeType } from "@vite/shared";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "transform-svg",
  async transform(content, filePath, { isModuleRequest }) {
    const fileRegex = /\.(svg)$/;
    if (!fileRegex.test(filePath) || typeof content !== "string") return null;

    if (!isModuleRequest) {
      return {
        code: content,
        mimeType: getMimeType(".svg"),
        map: null,
      };
    }

    const encodedSvg = encodeURIComponent(content.trim())
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
    const code = `export default "data:image/svg+xml,${encodedSvg}";`;

    return {
      code,
      mimeType: "application/javascript",
      map: null,
    };
  },
};

export default plugin;
