import { describe, it, expect } from "vitest";
import {
  formatBytes,
  gzipEstimate,
  brotliEstimate,
  getFileCategory,
  CATEGORY_COLORS,
} from "../src/utils";

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500.00 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1536)).toBe("1.50 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(2 * 1048576)).toBe("2.00 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1.00 GB");
  });
});

describe("gzipEstimate", () => {
  it("estimates gzip size as 35%", () => {
    expect(gzipEstimate(1000)).toBe(350);
    expect(gzipEstimate(0)).toBe(0);
    expect(gzipEstimate(10000)).toBe(3500);
  });
});

describe("brotliEstimate", () => {
  it("estimates brotli size as 25%", () => {
    expect(brotliEstimate(1000)).toBe(250);
    expect(brotliEstimate(0)).toBe(0);
    expect(brotliEstimate(10000)).toBe(2500);
  });
});

describe("getFileCategory", () => {
  it("categorizes JavaScript files", () => {
    expect(getFileCategory("main.js")).toBe("JavaScript");
    expect(getFileCategory("vendor.mjs")).toBe("JavaScript");
    expect(getFileCategory("lib.cjs")).toBe("JavaScript");
  });

  it("categorizes CSS files", () => {
    expect(getFileCategory("style.css")).toBe("CSS");
  });

  it("categorizes image files", () => {
    expect(getFileCategory("logo.png")).toBe("图片");
    expect(getFileCategory("photo.jpg")).toBe("图片");
    expect(getFileCategory("photo.jpeg")).toBe("图片");
    expect(getFileCategory("icon.gif")).toBe("图片");
    expect(getFileCategory("hero.webp")).toBe("图片");
  });

  it("categorizes SVG separately", () => {
    expect(getFileCategory("icon.svg")).toBe("SVG");
  });

  it("categorizes fonts", () => {
    expect(getFileCategory("font.woff")).toBe("字体");
    expect(getFileCategory("font.woff2")).toBe("字体");
    expect(getFileCategory("font.ttf")).toBe("字体");
  });

  it("categorizes HTML", () => {
    expect(getFileCategory("index.html")).toBe("HTML");
  });

  it("categorizes Sourcemap", () => {
    expect(getFileCategory("main.js.map")).toBe("Sourcemap");
  });

  it("categorizes JSON", () => {
    expect(getFileCategory("data.json")).toBe("JSON");
  });

  it("returns 其他 for unknown types", () => {
    expect(getFileCategory("file.xyz")).toBe("其他");
    expect(getFileCategory("readme.md")).toBe("其他");
  });
});

describe("CATEGORY_COLORS", () => {
  it("has colors for all categories", () => {
    const categories = [
      "JavaScript",
      "CSS",
      "图片",
      "SVG",
      "字体",
      "HTML",
      "Sourcemap",
      "JSON",
      "其他",
    ];
    for (const cat of categories) {
      expect(CATEGORY_COLORS[cat]).toBeDefined();
      expect(CATEGORY_COLORS[cat]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
