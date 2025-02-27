import {
  compileScript,
  compileStyle,
  compileTemplate,
  parse,
  rewriteDefault,
} from "@vue/compiler-sfc";
import { rewriteImports } from "../imports";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "transform-vue",
  async transform(content, filePath) {
    const fileRegex = /\.(vue)$/;

    if (!fileRegex.test(filePath) || typeof content !== "string") {
      return null;
    }

    try {
      const { descriptor } = parse(content, {
        filename: filePath,
        sourceMap: true,
      });

      const id = Date.now().toString();
      const scopeId = `data-v-${id}`;
      const codeList: string[] = [];

      const script = compileScript(descriptor, {
        id: scopeId,
        sourceMap: true,
        inlineTemplate: false,
      });
      const scriptContent = await rewriteImports(script.content, filePath);
      codeList.push(
        rewriteDefault(scriptContent, "__sfc_main__"),
        `__sfc_main__.__scopeId='${scopeId}';`
      );
      if (descriptor.template) {
        const template = compileTemplate({
          source: descriptor.template.content,
          filename: filePath,
          id: scopeId,
          scoped: descriptor.styles.some((s) => s.scoped),
        });

        codeList.push(
          await rewriteImports(template.code, filePath),
          `__sfc_main__.render=render;`,
          `export default __sfc_main__;`
        );
      }

      for (const styleBlock of descriptor.styles) {
        const styleCode = compileStyle({
          source: styleBlock.content,
          id,
          filename: filePath,
          scoped: styleBlock.scoped,
        });

        codeList.push(
          `var el = document.createElement('style');`,
          `el.innerHTML = \`${styleCode.code}\`;`,
          `document.body.append(el);`
        );
      }

      return {
        code: codeList.join("\n"),
        mimeType: "application/javascript",
        map: (script.map as any) ?? null,
      };
    } catch (error) {
      console.error(`Error transforming Vue file ${filePath}:`, error);
      return null;
    }
  },
};

export default plugin;
