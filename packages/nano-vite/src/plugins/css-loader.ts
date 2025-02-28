import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "css-loader",
  async transform(content, filePath) {
    const fileRegex = /\.(css)$/;
    if (!fileRegex.test(filePath) || typeof content !== "string") return null;

    const code = `
          const style = document.createElement('style');
          style.textContent = ${JSON.stringify(content)};
          document.head.appendChild(style);
          export default {};
        `;

    return {
      code,
      mimeType: "application/javascript",
      map: null,
    };
  },
};

export default plugin;
