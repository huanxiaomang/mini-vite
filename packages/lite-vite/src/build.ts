import { cp, mkdir, rm, stat } from "node:fs/promises";
import { basename, extname, join, resolve, relative } from "node:path";
import { existsSync } from "node:fs";
import { copyFiles, log } from "@lite-vite/shared";
import { type OutputOptions, type OutputChunk, type OutputAsset, rollup } from "rollup";
import picocolors from "picocolors";
import { OUT_DIR, ROOT } from "./constant";
import { extractEntryFromHtml, updateHtmlScript } from "./utils/index";
import { getRollupOptions } from "./rollup";
import { generateReport, type FileInfo } from "./report/index";
import type { ViteContext } from "./type";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

export async function build(ctx: ViteContext): Promise<void> {
  const startTime = Date.now();
  log.info("Building for production...");

  for (const p of ctx.plugins) {
    if (p.buildStart) await p.buildStart();
  }

  const outputDir = ctx.output ?? OUT_DIR;
  const entry = resolve(ROOT, ctx.entry);
  const hasTsConfig = existsSync(resolve(ROOT, "tsconfig.json"));
  const minify = ctx.build?.minify ?? false;
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

  const rollupOptions = getRollupOptions({ hasTsConfig, input, minify, userPlugins: ctx.plugins });
  const format = ctx.format ?? "esm";
  const outputOptions: OutputOptions = {
    dir: outputDir,
    format,
    sourcemap: ctx.sourcemap ?? false,
    chunkFileNames: "[name]-[hash].js",
    entryFileNames: `${entryFileName}.js`,
  };

  try {
    const bundle = await rollup(rollupOptions);
    const { output } = await bundle.write(outputOptions);
    await bundle.close();

    if (htmlOutputPath) {
      const entryChunk = output.find((c) => c.type === "chunk" && c.isEntry);
      if (entryChunk?.fileName) {
        await updateHtmlScript(htmlOutputPath, `./${entryChunk.fileName}`);
      }
    }

    await copyFiles(resolve(ROOT, "public"), outputDir);

    for (const p of ctx.plugins) {
      if (p.writeBundle) await p.writeBundle();
    }

    for (const p of ctx.plugins) {
      if (p.buildEnd) await p.buildEnd();
    }

    const buildTimeMs = Date.now() - startTime;
    log.info(picocolors.green(`\u2713 Built in ${(buildTimeMs / 1000).toFixed(2)}s`));
    log.info(picocolors.green(`Output: ${outputDir}`));

    const files: FileInfo[] = [];
    for (const item of output) {
      if (item.type === "chunk") {
        const chunk = item as OutputChunk;
        const filePath = join(outputDir, chunk.fileName);
        const size = (await stat(filePath)).size;
        files.push({
          name: chunk.fileName,
          size,
          type: "chunk",
          isEntry: chunk.isEntry,
          isDynamicEntry: chunk.isDynamicEntry,
          modules: Object.entries(chunk.modules).map(([name, info]) => ({
            name: relative(ROOT, name),
            size: info.renderedLength,
          })),
          imports: chunk.imports,
          exports: chunk.exports,
        });
      } else {
        const asset = item as OutputAsset;
        const filePath = join(outputDir, asset.fileName);
        try {
          const size = (await stat(filePath)).size;
          files.push({ name: asset.fileName, size, type: "asset" });
        } catch {}
      }
    }

    for (const item of output) {
      if (item.type === "chunk") {
        const c = item as OutputChunk;
        log.info(
          `  ${picocolors.green(c.isEntry ? "entry" : "chunk")} ${picocolors.cyan(c.fileName)} ${picocolors.gray(formatBytes(Buffer.byteLength(c.code)))}`
        );
      }
    }

    await generateReport(outputDir, files, buildTimeMs, entry, format);
  } catch (err) {
    log.error(picocolors.red("Build failed:"), err);
    throw err;
  }
}
