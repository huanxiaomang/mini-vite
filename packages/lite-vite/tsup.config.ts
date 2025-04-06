import { mkdir } from "fs/promises";
import { join } from "path";
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["cjs"],
    splitting: false,
    clean: false,
    dts: true,
    external: ["sourcemap", "rollup"],
  },
  {
    entry: ["src/client/hmr-client.ts"],
    format: ["esm"],
    outDir: "dist/client",
    dts: false,
    async onSuccess() {
      try {
        await mkdir(join(__dirname, "dist/client"), { recursive: true });
      } catch (err: any) {
        if (err.code !== "EEXIST") {
          console.error("创建客户端目录失败:", err);
        }
      }
    },
  },
]);
