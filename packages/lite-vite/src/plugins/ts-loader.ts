import esbuild from "esbuild";
import { rewriteImports } from "../imports";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "ts-loader",
  async transform(content, filePath) {
    const fileRegex = /\.(ts)$/;

    if (!fileRegex.test(filePath) || typeof content !== "string") return null;

    try {
      const result = await esbuild.transform(content, {
        loader: "ts",
        target: "esnext",
        format: "esm",
        sourcemap: "inline",
        sourcefile: filePath,
      });

      const codeWithMap = result.code;

      const rewrittenCodeWithMap = await rewriteImports(codeWithMap, filePath);

      return {
        code: rewrittenCodeWithMap,
        mimeType: "application/javascript",
        map: null,
      };
    } catch (error) {
      console.error(`Error transforming ${filePath}:`, error);
      throw error;
    }
  },
};

export default plugin;
