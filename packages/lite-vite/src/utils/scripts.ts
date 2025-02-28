import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { log } from "@lite-vite/shared";
import { parse, serialize } from "parse5";
import type { Element, Node } from "../type";

export async function extractEntryFromHtml(
  htmlPath: string
): Promise<string | null> {
  const htmlContent = await readFile(htmlPath, "utf-8");
  const document = parse(htmlContent) as Node;

  const findScript = (node: Node): string | null => {
    if (node.nodeName === "script") {
      const element = node as Element;
      const attrs = element.attrs ?? [];
      const isModule = attrs.some(
        (attr) => attr.name === "type" && attr.value === "module"
      );
      if (isModule) {
        const srcAttr = attrs.find((attr) => attr.name === "src");
        return srcAttr?.value ?? null;
      }
    }
    if ("childNodes" in node && node.childNodes?.length) {
      for (const child of node.childNodes) {
        const result = findScript(child);
        if (result) return result;
      }
    }
    return null;
  };

  const scriptSrc = findScript(document);
  if (!scriptSrc) {
    log.debug("No module script found in HTML");
    return null;
  }

  const entryPath = join(dirname(htmlPath), scriptSrc);
  if (!existsSync(entryPath)) {
    throw new Error(`Entry module "${entryPath}" does not exist`);
  }
  return entryPath;
}

export async function updateHtmlScript(
  htmlPath: string,
  newScriptSrc: string
): Promise<void> {
  const htmlContent = await readFile(htmlPath, "utf-8");
  const document = parse(htmlContent) as Node;

  const updateScript = (node: Node): boolean => {
    if (node.nodeName === "script") {
      const element = node as Element;
      const attrs = element.attrs ?? [];
      const isModule = attrs.some(
        (attr) => attr.name === "type" && attr.value === "module"
      );
      if (isModule) {
        const srcAttrIndex = attrs.findIndex((attr) => attr.name === "src");
        if (srcAttrIndex !== -1) {
          attrs[srcAttrIndex].value = newScriptSrc;
        } else {
          attrs.push({ name: "src", value: newScriptSrc });
        }
        element.attrs = attrs;
        return true;
      }
    }
    return "childNodes" in node && node.childNodes?.length
      ? node.childNodes.some(updateScript)
      : false;
  };

  updateScript(document);
  await writeFile(htmlPath, serialize(document as any), "utf-8");
}
