import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { log } from "@lite-vite/shared";
import picocolors from "picocolors";
import { collectReportData, loadHistory, saveHistory } from "./data";
import { generateHTML } from "./html";
import type { FileInfo } from "./types";

export type { FileInfo, ReportData, BuildRecord, BuildHistory, DuplicateGroup, DiffEntry, ModuleInfo } from "./types";
export { analyzeDir } from "./analyze";
export { collectReportData, detectDuplicates, generateSuggestions, computeDiff, loadHistory, saveHistory } from "./data";
export { generateHTML } from "./html";
export { formatBytes, gzipEstimate, brotliEstimate, getFileCategory, CATEGORY_COLORS } from "./utils";

export async function generateReport(
  outputDir: string,
  files: FileInfo[],
  buildTimeMs: number,
  entry: string,
  format: string,
): Promise<void> {
  const history = await loadHistory(outputDir);

  const chunks = files.filter((f) => f.type === "chunk");
  const cssFiles = files.filter((f) => f.type === "asset" && f.name.endsWith(".css"));
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const jsSize = chunks.reduce((s, f) => s + f.size, 0);
  const cssSize = cssFiles.reduce((s, f) => s + f.size, 0);
  const totalModules = files.reduce((s, f) => s + (f.modules?.length || 0), 0);

  history.records.push({
    id: Date.now(),
    timestamp: new Date().toLocaleString("zh-CN"),
    files: files.map((f) => ({ name: f.name, size: f.size })),
    totalSize,
    jsSize,
    cssSize,
    otherSize: totalSize - jsSize - cssSize,
    buildTimeMs,
    fileCount: files.length,
    moduleCount: totalModules,
  });

  const data = collectReportData(files, buildTimeMs, entry, format, outputDir, history);
  const html = generateHTML(data);

  const reportPath = join(outputDir, "build-report.html");
  await writeFile(reportPath, html, "utf-8");
  await saveHistory(outputDir, history);

  log.info(picocolors.cyan(`📊 构建报告: ${reportPath}`));
}
