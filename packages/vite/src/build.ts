import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { log } from "@vite/shared";
import { type OutputOptions, type RollupOptions, rollup } from "rollup";
import picocolors from "picocolors";
import { parse, serialize } from "parse5";
import nodeResolve from "@rollup/plugin-node-resolve";
import vuePlugin from "rollup-plugin-vue";
import images from "@rollup/plugin-image";
import postcss from "rollup-plugin-postcss";
import replace from "@rollup/plugin-replace";
import typescript from "rollup-plugin-typescript2";
import { OUT_DIR, ROOT } from "./constant";
import type { ViteContext } from "./type";

async function extractEntryFromHtml(htmlPath: string): Promise<string | null> {
  const htmlContent = await readFile(htmlPath, "utf-8");
  const document = parse(htmlContent);

  function findScript(node: any): string | null {
    if (node.nodeName === "script") {
      const attrs = node.attrs || [];
      const isModule = attrs.some(
        (attr: any) => attr.name === "type" && attr.value === "module"
      );
      if (isModule) {
        const srcAttr = attrs.find((attr: any) => attr.name === "src");
        return srcAttr ? srcAttr.value : null;
      }
    }
    if (node.childNodes) {
      for (const child of node.childNodes) {
        const result = findScript(child);
        if (result) return result;
      }
    }
    return null;
  }

  const scriptSrc = findScript(document);
  if (!scriptSrc) {
    log.debug("No <script type='module'> found in HTML");
    return null;
  }

  const entryPath = join(dirname(htmlPath), scriptSrc);
  if (!existsSync(entryPath)) {
    throw new Error(`Entry module "${entryPath}" does not exist`);
  }

  return entryPath;
}

async function updateHtmlScript(
  htmlPath: string,
  newScriptSrc: string
): Promise<void> {
  const htmlContent = await readFile(htmlPath, "utf-8");
  const document = parse(htmlContent);

  function updateScript(node: any): boolean {
    if (node.nodeName === "script") {
      const attrs = node.attrs || [];
      const isModule = attrs.some(
        (attr: any) => attr.name === "type" && attr.value === "module"
      );
      if (isModule) {
        const srcAttrIndex = attrs.findIndex(
          (attr: any) => attr.name === "src"
        );
        if (srcAttrIndex !== -1) {
          attrs[srcAttrIndex].value = newScriptSrc;
        } else {
          attrs.push({ name: "src", value: newScriptSrc });
        }
        node.attrs = attrs;
        return true;
      }
    }
    if (node.childNodes) {
      for (const child of node.childNodes) {
        if (updateScript(child)) return true;
      }
    }
    return false;
  }

  updateScript(document);
  const updatedHtml = serialize(document);
  await writeFile(htmlPath, updatedHtml, "utf-8");
}

async function copyPublicFiles(src: string, dest: string) {
  const files = await readdir(src, { withFileTypes: true });

  for (const file of files) {
    const srcPath = join(src, file.name);
    const destPath = join(dest, file.name);

    if (file.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyPublicFiles(srcPath, destPath);
    } else {
      await cp(srcPath, destPath);
    }
  }
}

export async function build(ctx: ViteContext): Promise<void> {
  log.info("开始构建...");

  const outputDir = ctx.output || OUT_DIR;

  // 清空输出目录
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir);

  let entry = resolve(ROOT, ctx.entry);
  let htmlOutputPath: string | null = null;
  let entryFileName: string = "main";

  if (extname(entry) === ".html") {
    const result = await extractEntryFromHtml(entry);
    if (result === null) return;
    entry = result;
    htmlOutputPath = join(outputDir, "index.html");
    await cp(resolve(ROOT, ctx.entry), htmlOutputPath);
    entryFileName = basename(entry, extname(entry));
  }

  const hasTsConfig = existsSync(resolve(ROOT, "tsconfig.json"));

  const rollupOptions: RollupOptions = {
    input: entry,
    plugins: [
      nodeResolve({
        extensions: [".mjs", ".js", ".ts", ".vue"],
      }),
      replace({
        "process.env.NODE_ENV": JSON.stringify("production"),
        preventAssignment: true,
      }),
      vuePlugin(),
      postcss(),
      hasTsConfig
        ? typescript({
            check: false,
          })
        : null,
      images({ include: ["**/*.png", "**/*.jpg", "**/*.svg"] }),
    ],
    onwarn: ({ message }) => log.warn(picocolors.yellow(message)),
  };

  const outputOptions: OutputOptions = {
    dir: outputDir,
    format: ctx.format || "esm",
    sourcemap: ctx.sourcemap || false,
    chunkFileNames: "[name]-[hash].js",
    entryFileNames: "[name].js",
  };

  try {
    const bundle = await rollup(rollupOptions);
    const { output } = await bundle.write(outputOptions);
    await bundle.close();

    if (htmlOutputPath) {
      const entryChunk = output.find(
        (chunk) => chunk.type === "chunk" && chunk.isEntry
      );
      if (entryChunk && "fileName" in entryChunk) {
        const relativeScriptPath = `./${entryChunk.fileName}`;
        await updateHtmlScript(htmlOutputPath, relativeScriptPath);
      }
    }

    await copyPublicFiles(resolve(ROOT, "public"), outputDir);

    log.info(picocolors.green(`构建完成，输出目录: ${outputDir}`));
  } catch (err) {
    log.error(picocolors.red("构建失败:"), err);
    throw err;
  }
}
