import { IMG_EXTENSIONS, getMimeType } from "@nano-vite/shared";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "image-loader",
  async transform(content, filePath, { isModuleRequest, relativePath }) {
    let ext: string = "";
    for (const imgExt of IMG_EXTENSIONS) {
      if (filePath.endsWith(imgExt)) {
        ext = imgExt;
        break;
      }
    }

    if (!ext) return null;

    if (!isModuleRequest) {
      return {
        code: content,
        mimeType: getMimeType(ext),
        map: null,
      };
    }
    let code: string = "";
    if (ext === ".svg") {
      const encodedSvg = encodeURIComponent((content as string).trim())
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
      code = `export default "data:image/svg+xml,${encodedSvg}";`;
    } else {
      code = `export default "${relativePath}";`;
    }

    return {
      code,
      mimeType: "application/javascript",
      map: null,
    };
  },
};

export default plugin;
