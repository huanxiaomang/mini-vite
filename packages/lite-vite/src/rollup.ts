import nodeResolve from "@rollup/plugin-node-resolve";
import vuePlugin from "rollup-plugin-vue";
import images from "@rollup/plugin-image";
import postcss from "rollup-plugin-postcss";
import replace from "@rollup/plugin-replace";
import typescript from "rollup-plugin-typescript2";
import picocolors from "picocolors";
import { log } from "@lite-vite/shared";
import type { RollupOptions, Plugin } from "rollup";
import type { PluginOption } from "./type";

interface RollupParams {
  hasTsConfig: boolean;
  input: string;
  minify?: boolean;
  userPlugins?: PluginOption[];
}

function esbuildMinify(): Plugin {
  return {
    name: "esbuild-minify",
    async renderChunk(code) {
      const esbuild = await import("esbuild");
      const result = await esbuild.default.transform(code, {
        minify: true,
        target: "esnext",
      });
      return { code: result.code, map: result.map || null };
    },
  };
}

function adaptUserPlugins(userPlugins: PluginOption[]): Plugin[] {
  return userPlugins
    .filter((p) => p.transform)
    .map((p) => ({
      name: `user:${p.name}`,
      async transform(code: string, id: string) {
        const result = await p.transform!(code, id, {
          isModuleRequest: true,
          port: 0,
          relativePath: id,
        });
        if (!result) return null;
        return { code: result.code as string, map: result.map as any };
      },
    }));
}

export const getRollupOptions = ({
  hasTsConfig,
  input,
  minify,
  userPlugins = [],
}: RollupParams): RollupOptions => ({
  input: input!,
  plugins: [
    nodeResolve({ extensions: [".mjs", ".js", ".ts", ".vue", ".txt", ".json"] }),
    replace({
      "process.env.NODE_ENV": JSON.stringify("production"),
      preventAssignment: true,
    }),
    vuePlugin(),
    postcss(),
    hasTsConfig ? typescript({ check: false }) : null,
    images({ include: ["**/*.png", "**/*.jpg", "**/*.svg"] }),
    ...adaptUserPlugins(userPlugins),
    minify ? esbuildMinify() : null,
  ].filter(Boolean),
  onwarn: ({ message }) => log.warn(picocolors.yellow(message)),
});
