import { getMimeType } from "@vite/shared";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "transform-png",
  async transform(content, filePath, { isModuleRequest, relativePath }) {
    const fileRegex = /\.(png)$/;
    if (!fileRegex.test(filePath)) return null;

    if (!isModuleRequest) {
      return {
        code: content,
        mimeType: getMimeType(".png"),
        map: null,
      };
    }

    const code = `export default "${relativePath}";`;

    return {
      code,
      mimeType: "application/javascript",
      map: null,
    };
  },
};

export default plugin;
