import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FileInfo, BuildRecord, BuildHistory } from "../src/types";
import {
  detectDuplicates,
  generateSuggestions,
  computeDiff,
  collectReportData,
  loadHistory,
  saveHistory,
} from "../src/data";

// --- detectDuplicates ---

describe("detectDuplicates", () => {
  it("returns empty for files without modules", () => {
    const files: FileInfo[] = [
      { name: "main.js", size: 1000, type: "chunk" },
    ];
    expect(detectDuplicates(files)).toEqual([]);
  });

  it("returns empty when no duplicates exist", () => {
    const files: FileInfo[] = [
      {
        name: "main.js",
        size: 1000,
        type: "chunk",
        modules: [{ name: "node_modules/vue/index.js", size: 500 }],
      },
    ];
    expect(detectDuplicates(files)).toEqual([]);
  });

  it("detects duplicates across chunks", () => {
    const files: FileInfo[] = [
      {
        name: "main.js",
        size: 1000,
        type: "chunk",
        modules: [{ name: "node_modules/lodash/index.js", size: 200 }],
      },
      {
        name: "vendor.js",
        size: 800,
        type: "chunk",
        modules: [{ name: "node_modules/lodash/utils.js", size: 150 }],
      },
    ];
    const result = detectDuplicates(files);
    expect(result.length).toBe(1);
    expect(result[0].packageName).toBe("lodash");
    expect(result[0].totalWaste).toBe(150);
  });

  it("detects scoped package duplicates", () => {
    const files: FileInfo[] = [
      {
        name: "a.js",
        size: 100,
        type: "chunk",
        modules: [{ name: "node_modules/@vue/reactivity/index.js", size: 300 }],
      },
      {
        name: "b.js",
        size: 100,
        type: "chunk",
        modules: [{ name: "node_modules/@vue/reactivity/ref.js", size: 100 }],
      },
    ];
    const result = detectDuplicates(files);
    expect(result.length).toBe(1);
    expect(result[0].packageName).toBe("reactivity");
  });

  it("sorts by totalWaste descending", () => {
    const files: FileInfo[] = [
      {
        name: "a.js",
        size: 100,
        type: "chunk",
        modules: [
          { name: "node_modules/small/index.js", size: 50 },
          { name: "node_modules/big/index.js", size: 500 },
        ],
      },
      {
        name: "b.js",
        size: 100,
        type: "chunk",
        modules: [
          { name: "node_modules/small/utils.js", size: 30 },
          { name: "node_modules/big/utils.js", size: 300 },
        ],
      },
    ];
    const result = detectDuplicates(files);
    expect(result.length).toBe(2);
    expect(result[0].packageName).toBe("big");
    expect(result[1].packageName).toBe("small");
  });
});

// --- generateSuggestions ---

describe("generateSuggestions", () => {
  it("returns good status when no issues", () => {
    const files: FileInfo[] = [
      { name: "main.js", size: 50 * 1024, type: "chunk" },
      { name: "style.css", size: 5 * 1024, type: "asset" },
    ];
    const result = generateSuggestions(55 * 1024, 50 * 1024, 5 * 1024, files, false, []);
    expect(result).toEqual(["构建状态良好，未发现明显问题。"]);
  });

  it("warns about large JS", () => {
    const files: FileInfo[] = [
      { name: "main.js", size: 600 * 1024, type: "chunk" },
    ];
    const result = generateSuggestions(600 * 1024, 600 * 1024, 0, files, false, []);
    expect(result.some((s) => s.includes("500KB"))).toBe(true);
  });

  it("warns about single chunk", () => {
    const files: FileInfo[] = [
      { name: "main.js", size: 250 * 1024, type: "chunk" },
    ];
    const result = generateSuggestions(250 * 1024, 250 * 1024, 0, files, false, []);
    expect(result.some((s) => s.includes("单个 chunk"))).toBe(true);
  });

  it("warns about missing CSS", () => {
    const files: FileInfo[] = [
      { name: "main.js", size: 100, type: "chunk" },
    ];
    const result = generateSuggestions(100, 100, 0, files, false, []);
    expect(result.some((s) => s.includes("CSS"))).toBe(true);
  });

  it("warns about sourcemap", () => {
    const result = generateSuggestions(100, 50, 50, [], true, []);
    expect(result.some((s) => s.includes("Sourcemap"))).toBe(true);
  });

  it("warns about duplicates", () => {
    const dupes = [{ packageName: "lodash", instances: [], totalWaste: 5000 }];
    const result = generateSuggestions(100, 50, 50, [], false, dupes);
    expect(result.some((s) => s.includes("重复依赖"))).toBe(true);
  });

  it("warns about total size > 2MB", () => {
    const result = generateSuggestions(3 * 1024 * 1024, 50, 50, [], false, []);
    expect(result.some((s) => s.includes("2MB"))).toBe(true);
  });

  it("warns about large images", () => {
    const files: FileInfo[] = [
      { name: "huge.png", size: 300 * 1024, type: "asset" },
      { name: "main.js", size: 100, type: "chunk" },
      { name: "style.css", size: 100, type: "asset" },
    ];
    const result = generateSuggestions(
      300 * 1024 + 200, 100, 100, files, false, []
    );
    expect(result.some((s) => s.includes("200KB 的图片"))).toBe(true);
  });
});

// --- computeDiff ---

describe("computeDiff", () => {
  it("returns empty array when record is null", () => {
    const files: FileInfo[] = [{ name: "a.js", size: 100, type: "chunk" }];
    expect(computeDiff(null, files)).toEqual([]);
  });

  it("detects added files", () => {
    const record: BuildRecord = {
      id: 1, timestamp: "", files: [], totalSize: 0,
      jsSize: 0, cssSize: 0, otherSize: 0, buildTimeMs: 0, fileCount: 0, moduleCount: 0,
    };
    const files: FileInfo[] = [{ name: "new.js", size: 200, type: "chunk" }];
    const diff = computeDiff(record, files);
    expect(diff[0].status).toBe("added");
    expect(diff[0].delta).toBe(200);
  });

  it("detects removed files", () => {
    const record: BuildRecord = {
      id: 1, timestamp: "", files: [{ name: "old.js", size: 300 }],
      totalSize: 300, jsSize: 300, cssSize: 0, otherSize: 0, buildTimeMs: 0, fileCount: 1, moduleCount: 0,
    };
    const diff = computeDiff(record, []);
    expect(diff[0].status).toBe("removed");
    expect(diff[0].delta).toBe(-300);
  });

  it("detects changed files", () => {
    const record: BuildRecord = {
      id: 1, timestamp: "", files: [{ name: "main.js", size: 100 }],
      totalSize: 100, jsSize: 100, cssSize: 0, otherSize: 0, buildTimeMs: 0, fileCount: 1, moduleCount: 0,
    };
    const files: FileInfo[] = [{ name: "main.js", size: 150, type: "chunk" }];
    const diff = computeDiff(record, files);
    expect(diff[0].status).toBe("changed");
    expect(diff[0].delta).toBe(50);
  });

  it("detects unchanged files", () => {
    const record: BuildRecord = {
      id: 1, timestamp: "", files: [{ name: "main.js", size: 100 }],
      totalSize: 100, jsSize: 100, cssSize: 0, otherSize: 0, buildTimeMs: 0, fileCount: 1, moduleCount: 0,
    };
    const files: FileInfo[] = [{ name: "main.js", size: 100, type: "chunk" }];
    const diff = computeDiff(record, files);
    expect(diff[0].status).toBe("unchanged");
    expect(diff[0].delta).toBe(0);
  });

  it("sorts by status priority then delta magnitude", () => {
    const record: BuildRecord = {
      id: 1, timestamp: "",
      files: [
        { name: "keep.js", size: 100 },
        { name: "old.js", size: 50 },
      ],
      totalSize: 150, jsSize: 150, cssSize: 0, otherSize: 0, buildTimeMs: 0, fileCount: 2, moduleCount: 0,
    };
    const files: FileInfo[] = [
      { name: "keep.js", size: 100, type: "chunk" },
      { name: "new.js", size: 200, type: "chunk" },
    ];
    const diff = computeDiff(record, files);
    expect(diff[0].status).toBe("added");
    expect(diff[1].status).toBe("removed");
    expect(diff[2].status).toBe("unchanged");
  });
});

// --- collectReportData ---

describe("collectReportData", () => {
  it("aggregates data correctly", () => {
    const files: FileInfo[] = [
      { name: "main.js", size: 1000, type: "chunk", modules: [{ name: "src/a.ts", size: 500 }], exports: ["default"] },
      { name: "style.css", size: 200, type: "asset" },
      { name: "main.js.map", size: 300, type: "asset" },
    ];
    const history: BuildHistory = { records: [] };
    const data = collectReportData(files, 1500, "index.html", "esm", "dist", history);

    expect(data.totalSize).toBe(1500);
    expect(data.jsSize).toBe(1000);
    expect(data.cssSize).toBe(200);
    expect(data.otherSize).toBe(300);
    expect(data.totalModules).toBe(1);
    expect(data.totalExports).toBe(1);
    expect(data.hasSourcemap).toBe(true);
    expect(data.allModules.length).toBe(1);
    expect(data.allModules[0].chunk).toBe("main.js");
    expect(data.suggestions.length).toBeGreaterThan(0);
    expect(data.diffEntries).toEqual([]);
    expect(data.selectedDiffId).toBeNull();
  });

  it("computes diff with previous build", () => {
    const files: FileInfo[] = [
      { name: "main.js", size: 1200, type: "chunk" },
    ];
    const history: BuildHistory = {
      records: [{
        id: 1, timestamp: "", files: [{ name: "main.js", size: 1000 }],
        totalSize: 1000, jsSize: 1000, cssSize: 0, otherSize: 0, buildTimeMs: 0, fileCount: 1, moduleCount: 0,
      }],
    };
    const data = collectReportData(files, 500, "index.html", "esm", "dist", history);

    expect(data.selectedDiffId).toBe(1);
    expect(data.diffEntries.length).toBe(1);
    expect(data.diffEntries[0].status).toBe("changed");
    expect(data.diffEntries[0].delta).toBe(200);
  });
});

// --- loadHistory / saveHistory ---

describe("loadHistory", () => {
  const tmpDir = join(tmpdir(), "lite-report-history-" + Date.now());
  const distDir = join(tmpDir, "dist");

  beforeEach(async () => {
    await mkdir(distDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty records when no history file", async () => {
    const h = await loadHistory(distDir);
    expect(h.records).toEqual([]);
  });

  it("loads existing history", async () => {
    const histDir = join(tmpDir, ".lite-vite");
    await mkdir(histDir, { recursive: true });
    const record = {
      records: [{ id: 1, timestamp: "test", files: [], totalSize: 0, jsSize: 0, cssSize: 0, otherSize: 0, buildTimeMs: 0, fileCount: 0, moduleCount: 0 }],
    };
    const { writeFile: wf } = await import("node:fs/promises");
    await wf(join(histDir, "build-history.json"), JSON.stringify(record));
    const h = await loadHistory(distDir);
    expect(h.records.length).toBe(1);
    expect(h.records[0].id).toBe(1);
  });
});

describe("saveHistory", () => {
  const tmpDir = join(tmpdir(), "lite-report-save-" + Date.now());
  const distDir = join(tmpDir, "dist");

  beforeEach(async () => {
    await mkdir(distDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("saves history to file", async () => {
    const history: BuildHistory = {
      records: [{ id: 1, timestamp: "now", files: [], totalSize: 100, jsSize: 50, cssSize: 50, otherSize: 0, buildTimeMs: 500, fileCount: 1, moduleCount: 0 }],
    };
    await saveHistory(distDir, history);
    const raw = await readFile(join(tmpDir, ".lite-vite", "build-history.json"), "utf-8");
    const saved = JSON.parse(raw);
    expect(saved.records.length).toBe(1);
    expect(saved.records[0].id).toBe(1);
  });
});
