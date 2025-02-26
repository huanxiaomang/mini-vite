import type { RollupOptions } from "rollup";

export interface PluginOption {}

export interface NativeViteOptions {
  entry: string;
  plugins?: PluginOption[];
  build?: {
    outdir: string;
    minify?: boolean;
    rollupOptions?: RollupOptions;
    lib: {
      entry: string;
      name: string;
      fileName: string;
    };
  };
}

export type ViteOptions = Omit<NativeViteOptions, "entry">;

export interface ViteContext extends NativeViteOptions {
  port?: number;
}
