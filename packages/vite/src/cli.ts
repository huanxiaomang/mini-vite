import { log } from "@vite/shared"; // 假设这是 Vite 提供的日志工具
import { program } from "commander";
import { startDevServer } from "./server"; // 开发服务器
import pkg from "../package.json" assert { type: "json" }; // ESM 导入 JSON
import { loadOptions } from "./options";
import { join, resolve } from "node:path";

// 主函数
async function main() {
  try {
    await registerCommands();
  } catch (err: any) {
    log.error(`错误: ${err.message}`);
    process.exit(1);
  }
}

// 注册命令
async function registerCommands() {
  program
    .name(Object.keys(pkg.bin)[0])
    .version(pkg.version, "-v, --version", "输出版本号")
    .usage("[command] [options]");

  // vite 命令（默认开发服务器）
  program
    .command("dev", { isDefault: true }) // 默认命令
    .description("启动 Vite 开发服务器")
    .option("--no-optimize", "禁用优化")
    .action(async (options) => {
      log.info(`Vite v${pkg.version}`);
      const entry = resolve(process.cwd(), "index.html");
      const ctx = loadOptions({
        entry,
      });
      await startDevServer(ctx);
    });

  // vite build 命令
  program
    .command("build")
    .description("构建生产包")
    .option("--no-optimize", "禁用优化")
    .action(async (options) => {
      log.info(`Vite v${pkg.version} - Building...`);
      //   await build({ optimize: !options.noOptimize });
    });

  // 处理未知命令
  program.on("command:*", (cmds) => {
    log.error(`未知命令: ${cmds[0]}`);
    program.outputHelp();
    process.exit(1);
  });

  // 处理 Ctrl+C
  process.on("SIGINT", () => {
    log.info("\n正在退出...");
    process.exit(0);
  });

  // 解析命令行参数
  await program.parseAsync(process.argv);

  // 如果没有参数，显示帮助
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

// 模拟构建函数（需自行实现）
async function build(options: { optimize: boolean }) {
  // 这里实现构建逻辑
  log.info(`构建中${options.optimize ? "（启用优化）" : "（禁用优化）"}...`);
  // 实际构建代码...
}

// 启动
main().catch((err) => {
  log.error(`启动失败: ${err.message}`);
  process.exit(1);
});
