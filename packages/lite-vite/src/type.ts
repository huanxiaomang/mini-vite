import { IncomingMessage, ServerResponse, type createServer } from "node:http";
import type { DefaultTreeAdapterMap } from "parse5";
import type { RollupOptions } from "rollup";
import type { RawSourceMap } from "source-map";

export type Node = DefaultTreeAdapterMap["node"];
export type Element = DefaultTreeAdapterMap["element"];

export interface ServerInstance {
  server: ReturnType<typeof createServer>;
  close: () => Promise<void>;
}

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: string;
  filePath: string;
  ext: string;
  isModuleRequest: boolean;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface PluginOption {
  name: string;
  buildStart?: () => void | Promise<void>;
  buildEnd?: () => void | Promise<void>;
  writeBundle?: () => void | Promise<void>;
  configResolved?: (config: ViteContext) => void;
  transform?: (
    content: string | Buffer,
    filePath: string,
    options: {
      isModuleRequest: boolean;
      port: number;
      relativePath: string;
    }
  ) => Promise<TransformResult | null>;
}

export interface TransformResult {
  code: string | Buffer;
  mimeType: string;
  map: RawSourceMap | null;
}

export interface UserConfig {
  entry?: string;
  port?: number;
  plugins?: PluginOption[];
  output?: string;
  sourcemap?: boolean;
  format?: "esm" | "cjs";
  logLevel?: LogLevel;
  clearScreen?: boolean;
  server?: {
    port?: number;
    open?: boolean;
    host?: string;
  };
  build?: {
    outdir?: string;
    minify?: boolean;
    sourcemap?: boolean;
    format?: "esm" | "cjs";
    rollupOptions?: RollupOptions;
    lib?: {
      entry: string;
      name: string;
      fileName: string;
    };
  };
  resolve?: {
    alias?: Record<string, string>;
    extensions?: string[];
  };
  define?: Record<string, string>;
}

export interface NativeViteOptions {
  entry: string;
  port?: number;
  plugins?: PluginOption[];
  output?: string;
  sourcemap?: boolean;
  format?: "esm" | "cjs";
  logLevel?: LogLevel;
  clearScreen?: boolean;
  server?: {
    open?: boolean;
    host?: string;
  };
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
  resolve?: {
    alias?: Record<string, string>;
    extensions?: string[];
  };
  define?: Record<string, string>;
}

export type ViteOptions = Omit<NativeViteOptions, "entry">;

export interface ViteContext extends NativeViteOptions {
  plugins: PluginOption[];
}
