import * as ts from "typescript";
import { rewriteImports } from "../imports";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "transform-ts",
  async transform(content, filePath) {
    const fileRegex = /\.(ts)$/;

    if (!fileRegex.test(filePath) || typeof content !== "string") return null;

    const result = ts.transpileModule(content, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
        sourceMap: true,
        inlineSourceMap: true,
        inlineSources: true,
      },
      fileName: filePath,
    });
    const codeWithMap = result.outputText;
    const rewrittenCodeWithMap = await rewriteImports(codeWithMap, filePath);

    return {
      code: rewrittenCodeWithMap,
      mimeType: "application/javascript",
      map: null,
    };
  },
};

export default plugin;
