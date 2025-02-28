import nodeResolve from "@rollup/plugin-node-resolve";
import vuePlugin from "rollup-plugin-vue";
import images from "@rollup/plugin-image";
import postcss from "rollup-plugin-postcss";
import replace from "@rollup/plugin-replace";
import typescript from "rollup-plugin-typescript2";
import picocolors from "picocolors";
import { log } from "@nano-vite/shared";
import type { RollupOptions } from "rollup";

interface RollupParams {
  hasTsConfig: boolean;
  input: string;
}

export const getRollupOptions = ({
  hasTsConfig,
  input,
}: RollupParams): RollupOptions => ({
  input: input!,
  plugins: [
    nodeResolve({ extensions: [".mjs", ".js", ".ts", ".vue"] }),
    replace({
      "process.env.NODE_ENV": JSON.stringify("production"),
      preventAssignment: true,
    }),
    vuePlugin(),
    postcss(),
    hasTsConfig ? typescript({ check: false }) : null,
    images({ include: ["**/*.png", "**/*.jpg", "**/*.svg"] }),
  ].filter(Boolean),
  onwarn: ({ message }) => log.warn(picocolors.yellow(message)),
});
