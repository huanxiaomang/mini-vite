import { resolve } from "node:path";
import { log } from "@nano-vite/shared";
import { program } from "commander";
import pkg from "../package.json" assert { type: "json" };
import { startDevServer } from "./server";
import { build } from "./build";
import { loadOptions } from "./options";

async function main() {
  try {
    await registerCommands();
  } catch (err: any) {
    log.error(`Error: ${err.message}`);
    process.exit(1);
  }
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
      log.info(`Vite v${pkg.version}`);
      const entry = resolve(process.cwd(), "index.html");
      const ctx = await loadOptions({
        entry,
        port: options.port,
      });
      await startDevServer(ctx);
    });

  program
    .command("build")
    .description("构建生产包")
    .option("--no-optimize", "禁用优化")
    .option("-o, --output <path>", "指定输出目录", "dist")
    .option("-f, --format <format>", "指定输出格式 (esm 或 cjs)", "esm")
    .option("-s, --sourcemap", "启用源映射", false)
    .action(async (options) => {
      log.info(`Vite v${pkg.version} - Building...`);
      const entry = resolve(process.cwd(), options.entry || "index.html");
      const ctx = await loadOptions({
        entry,
        output: resolve(process.cwd(), options.output),
        format: options.format as "esm" | "cjs",
        sourcemap: options.sourcemap,
      });
      await build(ctx);
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
