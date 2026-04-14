import { describe, it, expect } from "vitest";
import { defineLiteConfig, defineConfig } from "../src/options";

describe("defineLiteConfig", () => {
  it("is an identity function", () => {
    const config = { port: 3000, entry: "index.html" };
    expect(defineLiteConfig(config)).toBe(config);
  });

  it("returns empty config as-is", () => {
    const config = {};
    expect(defineLiteConfig(config)).toBe(config);
  });

  it("preserves complex config", () => {
    const config = {
      server: { port: 8080, open: true },
      build: { minify: true, outdir: "build" },
      plugins: [{ name: "test" }],
    };
    expect(defineLiteConfig(config)).toBe(config);
  });
});

describe("defineConfig", () => {
  it("is an alias of defineLiteConfig", () => {
    expect(defineConfig).toBe(defineLiteConfig);
  });
});
