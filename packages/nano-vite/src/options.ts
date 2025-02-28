import { defaultPlugins } from "./plugins";
import type { NativeViteOptions, ViteContext, ViteOptions } from "./type";

export const defineConfig = (config: ViteOptions): ViteOptions => config;

export const loadOptions = async (
  options: NativeViteOptions
): Promise<ViteContext> => {
  return {
    ...options,
    plugins: defaultPlugins,
  };
};
