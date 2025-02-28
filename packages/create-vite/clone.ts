import { cp, mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export const cloneTemplateTo = async (
  templateName: string,
  targetPath: string
) => {
  try {
    const templatePath = resolve(__dirname, templateName);
    await copyFiles(templatePath, targetPath);
  } catch (err) {
    throw new Error(`Cloning failed:${err}`);
  }
};

async function copyFiles(src: string, dest: string): Promise<void> {
  try {
    const files = await readdir(src, { withFileTypes: true });
    await Promise.all(
      files.map(async (file) => {
        if (file.name === "node_modules") return;

        const srcPath = join(src, file.name);
        const destPath = join(dest, file.name);

        if (file.isDirectory()) {
          await mkdir(destPath, { recursive: true });
          await copyFiles(srcPath, destPath);
        } else {
          await cp(srcPath, destPath);
        }
      })
    );
  } catch (err: any) {
    throw new Error(
      `Failed to copy files from ${src} to ${dest}: ${err.message}`
    );
  }
}
