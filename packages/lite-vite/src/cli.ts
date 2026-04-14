import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { exec } from "node:child_process";
import { log } from "@lite-vite/shared";
import { program } from "commander";
import pkg from "../package.json" assert { type: "json" };
import { startDevServer } from "./server";
import { build } from "./build";
import { loadOptions } from "./options";
import { analyzeDir, generateReport } from "@lite-vite/report";

async function main() {
  try {
    await registerCommands();
  } catch (err: any) {
    log.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function openBrowser(url: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} ${url}`);
}

async function registerCommands() {
  program
    .name(Object.keys(pkg.bin)[0])
    .version(pkg.version, "-v, --version", "输出版本号")
    .usage("[command] [options]");

  program
    .command("dev", { isDefault: true })
    .description("启动 Vite 开发服务器")
    .option("-p, --port <number>", "指定服务器端口号", Number.parseInt)
    .action(async (options) => {
      const entry = resolve(process.cwd(), "index.html");
      const ctx = await loadOptions({
        entry,
        port: options.port || undefined,
      });

      if (ctx.clearScreen !== false) {
        process.stdout.write("\x1Bc");
      }

      log.info(`Vite v${pkg.version}`);

      for (const p of ctx.plugins) {
        if (p.configResolved) p.configResolved(ctx);
      }

      const server = await startDevServer(ctx);
      const port = ctx.port || 4000;
      const host = ctx.server?.host || "localhost";

      if (ctx.server?.open) {
        openBrowser(`http://${host}:${port}`);
      }
    });

  program
    .command("build")
    .description("构建生产包")
    .option("--no-optimize", "禁用优化")
    .option("-o, --output <path>", "指定输出目录")
    .option("-f, --format <format>", "指定输出格式 (esm 或 cjs)")
    .option("-s, --sourcemap", "启用源映射")
    .action(async (options) => {
      const entry = resolve(process.cwd(), options.entry || "index.html");
      const ctx = await loadOptions({
        entry,
        output: options.output ? resolve(process.cwd(), options.output) : undefined,
        format: options.format || undefined,
        sourcemap: options.sourcemap ?? undefined,
      });

      if (ctx.clearScreen !== false) {
        process.stdout.write("\x1Bc");
      }

      log.info(`Vite v${pkg.version} - Building...`);

      for (const p of ctx.plugins) {
        if (p.configResolved) p.configResolved(ctx);
      }

      await build(ctx);
    });

  program
    .command("report")
    .description("分析构建产物并打开可视化报告")
    .option("-d, --dir <path>", "构建产物目录", "dist")
    .option("--no-open", "生成报告但不自动打开浏览器")
    .action(async (options) => {
      const outputDir = resolve(process.cwd(), options.dir);

      if (!existsSync(outputDir)) {
        log.error(`构建产物目录不存在: ${outputDir}`);
        log.info("请先运行 lite-vite build 进行构建");
        process.exit(1);
      }

      log.info(`正在分析构建产物: ${outputDir}`);

      const { files, totalTime } = await analyzeDir(outputDir);

      if (files.length === 0) {
        log.warn("未在目录中找到任何产物文件");
        process.exit(0);
      }

      log.info(`扫描到 ${files.length} 个文件`);

      const entry = resolve(process.cwd(), "index.html");
      await generateReport(outputDir, files, totalTime, entry, "esm");

      const reportPath = join(outputDir, "build-report.html");
      if (options.open !== false) {
        log.info("正在打开构建报告...");
        openBrowser(reportPath);
      }
    });

  program.on("command:*", (cmds) => {
    log.error(`未知命令: ${cmds[0]}`);
    program.outputHelp();
    process.exit(1);
  });

  process.on("SIGINT", () => {
    log.info("\n正在退出...");
    process.exit(0);
  });

  await program.parseAsync(process.argv);

  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

main().catch((err) => {
  log.error(`启动失败: ${err.message}`);
  process.exit(1);
});
