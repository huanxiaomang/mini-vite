import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import type { FileInfo } from "./types";

const CODE_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts"];

/**
 * 递归扫描目录，收集所有文件信息
 */
async function scanDir(dir: string, prefix = ""): Promise<FileInfo[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: FileInfo[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const subFiles = await scanDir(fullPath, relativeName);
      files.push(...subFiles);
    } else {
      // 跳过 HTML 报告本身
      if (entry.name === "build-report.html") continue;

      const info = await stat(fullPath);
      const ext = extname(entry.name).toLowerCase();
      const isChunk = CODE_EXTENSIONS.includes(ext) && !entry.name.endsWith(".map");

      files.push({
        name: relativeName,
        size: info.size,
        type: isChunk ? "chunk" : "asset",
        isEntry: isChunk && (entry.name.startsWith("main.") || entry.name.startsWith("index.")),
      });
    }
  }

  return files;
}

/**
 * 分析构建产物目录
 */
export async function analyzeDir(dir: string): Promise<{ files: FileInfo[]; totalTime: number }> {
  const startTime = Date.now();
  const files = await scanDir(dir);
  const totalTime = Date.now() - startTime;
  return { files, totalTime };
}
