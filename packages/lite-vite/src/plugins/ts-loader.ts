import esbuild from "esbuild";
import { log } from "@lite-vite/shared";
import { rewriteImports } from "../imports";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "ts-loader",
  async transform(content, filePath) {
    const fileRegex = /\.(tsx?|jsx)$/;

    if (!fileRegex.test(filePath) || typeof content !== "string") return null;
    try {
      // 使用 esbuild 转译 TS 代码
      const result = await esbuild.transform(content, {
        loader: /\.tsx?$/.test(filePath) ? "ts" : "jsx",
        target: "esnext",
        format: "esm",
        sourcemap: "inline",
        sourcefile: filePath,
      });

      let code = result.code;

      // 重写导入路径
      code = await rewriteImports(code, filePath);

      return {
        code,
        mimeType: "application/javascript",
        map: null,
      };
    } catch (error) {
      log.error(`TS 转译错误 ${filePath}:`, error);
      throw error;
    }
  },
};

export default plugin;
