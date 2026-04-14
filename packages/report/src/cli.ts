#!/usr/bin/env node
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { log } from "@lite-vite/shared";
import { program } from "commander";
import picocolors from "picocolors";
import { analyzeDir } from "./analyze";
import { generateReport } from "./index";

program
  .name("lite-report")
  .description("Lite Vite 构建产物分析工具")
  .version("1.0.0", "-v, --version")
  .argument("[dir]", "要分析的构建产物目录", "dist")
  .option("-e, --entry <path>", "入口文件路径", "index.html")
  .option("-f, --format <format>", "构建格式 (esm 或 cjs)", "esm")
  .option("-o, --output <path>", "报告输出路径（默认为分析目录内）")
  .action(async (dir: string, options: { entry: string; format: string; output?: string }) => {
    const targetDir = resolve(process.cwd(), dir);

    if (!existsSync(targetDir)) {
      log.error(picocolors.red(`目录不存在: ${targetDir}`));
      process.exit(1);
    }

    log.info(`正在分析构建产物: ${picocolors.cyan(targetDir)}`);

    try {
      const { files, totalTime } = await analyzeDir(targetDir);

      if (files.length === 0) {
        log.warn("未在目录中找到任何产物文件");
        process.exit(0);
      }

      log.info(`扫描到 ${picocolors.green(String(files.length))} 个文件`);

      const outputDir = options.output ? resolve(process.cwd(), options.output) : targetDir;
      const entry = resolve(process.cwd(), options.entry);

      await generateReport(outputDir, files, totalTime, entry, options.format);
    } catch (err: any) {
      log.error(picocolors.red(`分析失败: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
