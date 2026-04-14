import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  isObject,
  isFunction,
  normalizeImportPath,
  normalize,
  getMimeType,
  MIME_TYPES,
  TEXT_EXTENSIONS,
  BINARY_EXTENSIONS,
  IMG_EXTENSIONS,
  CODE_EXTENSIONS,
  fileExists,
  copyFiles,
  hasFolder,
  log,
} from "../index";

describe("isObject", () => {
  it("returns true for plain objects", () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
  });

  it("returns true for arrays", () => {
    expect(isObject([])).toBe(true);
    expect(isObject([1, 2])).toBe(true);
  });

  it("returns true for Date, RegExp, etc.", () => {
    expect(isObject(new Date())).toBe(true);
    expect(isObject(/regex/)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isObject(null)).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isObject(undefined)).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject("string")).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(Symbol())).toBe(false);
  });
});

describe("isFunction", () => {
  it("returns true for functions", () => {
    expect(isFunction(() => {})).toBe(true);
    expect(isFunction(function () {})).toBe(true);
    expect(isFunction(async () => {})).toBe(true);
  });

  it("returns true for class constructors", () => {
    expect(isFunction(class {})).toBe(true);
  });

  it("returns false for non-functions", () => {
    expect(isFunction(null)).toBe(false);
    expect(isFunction(undefined)).toBe(false);
    expect(isFunction(42)).toBe(false);
    expect(isFunction("string")).toBe(false);
    expect(isFunction({})).toBe(false);
  });
});

describe("normalizeImportPath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizeImportPath("src\\main.ts")).toBe("/src/main.ts");
  });

  it("adds leading slash for relative-like paths", () => {
    expect(normalizeImportPath("src/main.ts")).toBe("/src/main.ts");
  });

  it("normalizes already-correct paths", () => {
    expect(normalizeImportPath("/src/main.ts")).toBe("/src/main.ts");
  });

  it("handles nested backslashes", () => {
    expect(normalizeImportPath("src\\components\\App.vue")).toBe(
      "/src/components/App.vue"
    );
  });

  it("handles dot segments", () => {
    expect(normalizeImportPath("src/../lib/utils.ts")).toBe("/lib/utils.ts");
  });
});

describe("getMimeType", () => {
  it("returns correct MIME for known extensions", () => {
    expect(getMimeType(".html")).toBe("text/html");
    expect(getMimeType(".js")).toBe("application/javascript");
    expect(getMimeType(".ts")).toBe("application/javascript");
    expect(getMimeType(".css")).toBe("text/css");
    expect(getMimeType(".json")).toBe("application/json");
    expect(getMimeType(".svg")).toBe("image/svg+xml");
    expect(getMimeType(".png")).toBe("image/png");
    expect(getMimeType(".jpg")).toBe("image/jpeg");
    expect(getMimeType(".jpeg")).toBe("image/jpeg");
    expect(getMimeType(".txt")).toBe("text/plain");
    expect(getMimeType(".vue")).toBe("application/javascript");
  });

  it("returns octet-stream for unknown extensions", () => {
    expect(getMimeType(".xyz")).toBe("application/octet-stream");
    expect(getMimeType(".wasm")).toBe("application/octet-stream");
    expect(getMimeType("")).toBe("application/octet-stream");
  });
});

describe("MIME constants", () => {
  it("MIME_TYPES has all expected keys", () => {
    expect(Object.keys(MIME_TYPES).length).toBeGreaterThanOrEqual(10);
    expect(MIME_TYPES[".html"]).toBeDefined();
    expect(MIME_TYPES[".js"]).toBeDefined();
  });

  it("TEXT_EXTENSIONS includes common text types", () => {
    expect(TEXT_EXTENSIONS).toContain(".html");
    expect(TEXT_EXTENSIONS).toContain(".js");
    expect(TEXT_EXTENSIONS).toContain(".css");
    expect(TEXT_EXTENSIONS).toContain(".vue");
  });

  it("BINARY_EXTENSIONS includes image types", () => {
    expect(BINARY_EXTENSIONS).toContain(".png");
    expect(BINARY_EXTENSIONS).toContain(".jpg");
  });

  it("IMG_EXTENSIONS includes all image types", () => {
    expect(IMG_EXTENSIONS).toContain(".png");
    expect(IMG_EXTENSIONS).toContain(".svg");
  });

  it("CODE_EXTENSIONS includes code types", () => {
    expect(CODE_EXTENSIONS).toContain(".js");
    expect(CODE_EXTENSIONS).toContain(".ts");
    expect(CODE_EXTENSIONS).toContain(".vue");
  });
});

// --- normalize ---

describe("normalize", () => {
  it("normalizes paths", () => {
    expect(normalize("/foo/bar/../baz")).toBe("/foo/baz");
    expect(normalize("/foo/./bar")).toBe("/foo/bar");
    expect(normalize("foo//bar")).toBe("foo/bar");
  });
});

// --- fileExists ---

describe("fileExists", () => {
  const tmpDir = join(tmpdir(), "lite-vite-test-" + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns true for existing file", async () => {
    const f = join(tmpDir, "exists.txt");
    await writeFile(f, "hello");
    expect(await fileExists(f)).toBe(true);
  });

  it("returns false for non-existing file", async () => {
    expect(await fileExists(join(tmpDir, "nope.txt"))).toBe(false);
  });
});

// --- hasFolder ---

describe("hasFolder", () => {
  const tmpDir = join(tmpdir(), "lite-vite-folder-" + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns true for existing directory", async () => {
    expect(await hasFolder(tmpDir)).toBe(true);
  });

  it("returns false for non-existing path", async () => {
    expect(await hasFolder(join(tmpDir, "nope"))).toBe(false);
  });

  it("returns false for a file (not directory)", async () => {
    const f = join(tmpDir, "file.txt");
    await writeFile(f, "data");
    expect(await hasFolder(f)).toBe(false);
  });
});

// --- copyFiles ---

describe("copyFiles", () => {
  const tmpDir = join(tmpdir(), "lite-vite-copy-" + Date.now());
  const srcDir = join(tmpDir, "src");
  const destDir = join(tmpDir, "dest");

  beforeEach(async () => {
    await mkdir(srcDir, { recursive: true });
    await mkdir(join(srcDir, "sub"), { recursive: true });
    await writeFile(join(srcDir, "a.txt"), "aaa");
    await writeFile(join(srcDir, "sub", "b.txt"), "bbb");
    await mkdir(destDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("copies files recursively", async () => {
    await copyFiles(srcDir, destDir);
    expect(await fileExists(join(destDir, "a.txt"))).toBe(true);
    expect(await fileExists(join(destDir, "sub", "b.txt"))).toBe(true);
  });
});

// --- logger ---

describe("log", () => {
  it("is a callable function", () => {
    expect(typeof log).toBe("function");
  });

  it("has debug/info/warn/error methods", () => {
    expect(typeof log.debug).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  it("info outputs to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("test message");
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toContain("test message");
    spy.mockRestore();
  });

  it("warn outputs to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    log.warn("warn message");
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toContain("warn message");
    spy.mockRestore();
  });

  it("error outputs to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("error message");
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toContain("error message");
    spy.mockRestore();
  });

  it("debug outputs to console.log in development", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.debug("debug message");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("calling log directly acts as info", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("direct call");
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toContain("direct call");
    spy.mockRestore();
  });
});
