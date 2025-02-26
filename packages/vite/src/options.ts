import type { NativeViteOptions, ViteContext } from "./type";

export const defineConfig = () => {};

export const loadOptions = (options: NativeViteOptions): ViteContext => {
  return {
    ...options,
  };
};
