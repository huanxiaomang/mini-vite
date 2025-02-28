import { cp, mkdir, rm } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { copyFiles, log } from "@nano-vite/shared";
import { type OutputOptions, rollup } from "rollup";
import picocolors from "picocolors";
import { OUT_DIR, ROOT } from "./constant";
import { extractEntryFromHtml, updateHtmlScript } from "./utils/index";
import { getRollupOptions } from "./rollup";
import type { ViteContext } from "./type";

export async function build(ctx: ViteContext): Promise<void> {
  const startTime = Date.now();
  log.info("Building for production...");

  const outputDir = ctx.output ?? OUT_DIR;
  const entry = resolve(ROOT, ctx.entry);
  const hasTsConfig = existsSync(resolve(ROOT, "tsconfig.json"));
  let htmlOutputPath: string | null = null;
  let entryFileName = "main";
  let input = entry;

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir);

  if (extname(entry) === ".html") {
    const result = await extractEntryFromHtml(entry);
    if (!result) return;
    htmlOutputPath = join(outputDir, "index.html");
    await cp(resolve(ROOT, ctx.entry), htmlOutputPath);
    entryFileName = basename(result, extname(result));
    input = result;
  }

  const rollupOptions = getRollupOptions({
    hasTsConfig,
    input,
  });
  const outputOptions: OutputOptions = {
    dir: outputDir,
    format: ctx.format ?? "esm",
    sourcemap: ctx.sourcemap ?? false,
    chunkFileNames: "[name]-[hash].js",
    entryFileNames: `${entryFileName}.js`,
  };

  try {
    const bundle = await rollup(rollupOptions);
    const { output } = await bundle.write(outputOptions);
    await bundle.close();

    if (htmlOutputPath) {
      const entryChunk = output.find(
        (chunk) => chunk.type === "chunk" && chunk.isEntry
      );
      if (entryChunk?.fileName) {
        await updateHtmlScript(htmlOutputPath, `./${entryChunk.fileName}`);
      }
    }

    await copyFiles(resolve(ROOT, "public"), outputDir);
    const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info(picocolors.green(`✓ Built in ${buildTime}s`));
    log.info(picocolors.green(`Output: ${outputDir}`));
  } catch (err) {
    log.error(picocolors.red("Build failed:"), err);
    throw err;
  }
}
