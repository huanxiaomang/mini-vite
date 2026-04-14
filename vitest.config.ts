import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/tests/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      include: [
        "packages/shared/**/*.ts",
        "packages/report/src/**/*.ts",
        "packages/lite-vite/src/**/*.ts",
      ],
      exclude: [
        "**/dist/**",
        "**/tests/**",
        "**/*.config.ts",
        "**/cli.ts",
        "**/report/src/html.ts",
        "**/lite-vite/src/report/**",
        "**/lite-vite/src/client/**",
        "**/lite-vite/src/server.ts",
        "**/lite-vite/src/hmr.ts",
        "**/lite-vite/src/build.ts",
        "**/lite-vite/src/rollup.ts",
        "**/lite-vite/src/type.ts",
      ],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
    },
  },
});
