import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import type { FileInfo, DuplicateGroup, DiffEntry, BuildRecord, BuildHistory, ReportData } from "./types";

const LITE_VITE_DIR = ".lite-vite";
const HISTORY_FILE = "build-history.json";
const MAX_HISTORY = 50;

function historyDir(outputDir: string): string {
  return join(outputDir, "..", LITE_VITE_DIR);
}

function historyPath(outputDir: string): string {
  return join(historyDir(outputDir), HISTORY_FILE);
}

export function detectDuplicates(files: FileInfo[]): DuplicateGroup[] {
  const pkgMap = new Map<string, { module: string; chunk: string; size: number }[]>();
  for (const f of files) {
    if (!f.modules) continue;
    for (const m of f.modules) {
      const nm = m.name.match(/node_modules\/(?:@[^/]+\/)?([^/]+)/);
      if (!nm) continue;
      const pkg = nm[1];
      const arr = pkgMap.get(pkg) || [];
      arr.push({ module: m.name, chunk: f.name, size: m.size });
      pkgMap.set(pkg, arr);
    }
  }
  const groups: DuplicateGroup[] = [];
  for (const [packageName, instances] of pkgMap) {
    const uniqueChunks = new Set(instances.map((i) => i.chunk));
    if (uniqueChunks.size > 1 || instances.length > 1) {
      const sizes = instances.map((i) => i.size);
      const maxSize = Math.max(...sizes);
      const totalWaste = sizes.reduce((s, v) => s + v, 0) - maxSize;
      if (totalWaste > 0) {
        groups.push({ packageName, instances, totalWaste });
      }
    }
  }
  return groups.sort((a, b) => b.totalWaste - a.totalWaste);
}

export function generateSuggestions(
  totalSize: number, jsSize: number, cssSize: number,
  files: FileInfo[], hasSourcemap: boolean, duplicates: DuplicateGroup[],
): string[] {
  const s: string[] = [];
  if (jsSize > 500 * 1024) s.push("JavaScript 体积超过 500KB，建议使用代码分割或懒加载减小首屏加载体积。");
  if (jsSize > 200 * 1024 && files.filter((f) => f.type === "chunk").length === 1) s.push("所有 JS 集中在单个 chunk，建议将第三方库拆分为独立 chunk。");
  if (cssSize === 0 && jsSize > 0) s.push("未检测到 CSS 产物，请确认样式是否正确提取。");
  if (hasSourcemap) s.push("Sourcemap 已包含在产物中，请确保不要将其公开部署到 CDN。");
  if (duplicates.length > 0) s.push(`检测到 ${duplicates.length} 个重复依赖，浪费约 ${fmtB(duplicates.reduce((a, d) => a + d.totalWaste, 0))}。`);
  if (totalSize > 2 * 1024 * 1024) s.push("总体积超过 2MB，建议启用压缩、tree-shaking。");
  const largeImgs = files.filter((f) => [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(extname(f.name).toLowerCase()) && f.size > 200 * 1024);
  if (largeImgs.length > 0) s.push(`检测到 ${largeImgs.length} 个超过 200KB 的图片，建议使用 WebP/AVIF 格式。`);
  if (s.length === 0) s.push("构建状态良好，未发现明显问题。");
  return s;
}

function fmtB(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function loadHistory(outputDir: string): Promise<BuildHistory> {
  try {
    const raw = await readFile(historyPath(outputDir), "utf-8");
    return JSON.parse(raw);
  } catch {
    return { records: [] };
  }
}

export async function saveHistory(outputDir: string, history: BuildHistory): Promise<void> {
  try {
    await mkdir(historyDir(outputDir), { recursive: true });
    const trimmed = { records: history.records.slice(-MAX_HISTORY) };
    await writeFile(historyPath(outputDir), JSON.stringify(trimmed, null, 2), "utf-8");
  } catch {}
}

export function computeDiff(record: BuildRecord | null, files: FileInfo[]): DiffEntry[] {
  if (!record) return [];
  const entries: DiffEntry[] = [];
  const prevMap = new Map(record.files.map((f) => [f.name, f.size]));
  const newMap = new Map(files.map((f) => [f.name, f.size]));
  for (const f of files) {
    const oldSize = prevMap.get(f.name);
    if (oldSize === undefined) {
      entries.push({ file: f.name, status: "added", newSize: f.size, delta: f.size });
    } else if (oldSize !== f.size) {
      entries.push({ file: f.name, status: "changed", oldSize, newSize: f.size, delta: f.size - oldSize });
    } else {
      entries.push({ file: f.name, status: "unchanged", oldSize, newSize: f.size, delta: 0 });
    }
  }
  for (const pf of record.files) {
    if (!newMap.has(pf.name)) {
      entries.push({ file: pf.name, status: "removed", oldSize: pf.size, delta: -pf.size });
    }
  }
  return entries.sort((a, b) => {
    const order = { added: 0, removed: 1, changed: 2, unchanged: 3 };
    return order[a.status] - order[b.status] || Math.abs(b.delta || 0) - Math.abs(a.delta || 0);
  });
}

export function collectReportData(
  files: FileInfo[], buildTimeMs: number, entry: string, format: string,
  outputDir: string, history: BuildHistory,
): ReportData {
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const chunks = files.filter((f) => f.type === "chunk");
  const cssFiles = files.filter((f) => f.type === "asset" && f.name.endsWith(".css"));
  const jsSize = chunks.reduce((s, f) => s + f.size, 0);
  const cssSize = cssFiles.reduce((s, f) => s + f.size, 0);
  const otherSize = totalSize - jsSize - cssSize;
  const totalModules = files.reduce((s, f) => s + (f.modules?.length || 0), 0);
  const totalExports = files.reduce((s, f) => s + (f.exports?.length || 0), 0);
  const hasSourcemap = files.some((f) => f.name.endsWith(".map"));
  const allModules = files.flatMap((f) => (f.modules || []).map((m) => ({ ...m, chunk: f.name })));
  const duplicates = detectDuplicates(files);
  const suggestions = generateSuggestions(totalSize, jsSize, cssSize, files, hasSourcemap, duplicates);
  const prev = history.records.length > 0 ? history.records[history.records.length - 1] : null;
  const diffEntries = computeDiff(prev, files);
  return {
    files, buildTimeMs, entry, format, outputDir,
    totalSize, jsSize, cssSize, otherSize, totalModules, totalExports, hasSourcemap,
    allModules, duplicates, suggestions, history,
    selectedDiffId: prev?.id ?? null, diffEntries,
  };
}
