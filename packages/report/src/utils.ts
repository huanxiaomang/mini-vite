import { extname } from "node:path";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

export function gzipEstimate(size: number): number {
  return Math.round(size * 0.35);
}

export function brotliEstimate(size: number): number {
  return Math.round(size * 0.25);
}

export function getFileCategory(name: string): string {
  const ext = extname(name).toLowerCase();
  if ([".js", ".mjs", ".cjs"].includes(ext)) return "JavaScript";
  if (ext === ".css") return "CSS";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico"].includes(ext)) return "图片";
  if (ext === ".svg") return "SVG";
  if ([".woff", ".woff2", ".ttf", ".eot", ".otf"].includes(ext)) return "字体";
  if (ext === ".html") return "HTML";
  if (ext === ".map") return "Sourcemap";
  if (ext === ".json") return "JSON";
  return "其他";
}

export const CATEGORY_COLORS: Record<string, string> = {
  JavaScript: "#f59e0b",
  CSS: "#0ea5e9",
  "图片": "#10b981",
  SVG: "#8b5cf6",
  "字体": "#ec4899",
  HTML: "#ef4444",
  Sourcemap: "#6b7280",
  JSON: "#14b8a6",
  "其他": "#64748b",
};
