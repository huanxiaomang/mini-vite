import { resolve } from "node:path";
import { copyFiles } from "@lite-vite/shared";

export const cloneTemplateTo = async (
  templateName: string,
  targetPath: string
) => {
  const templatePath = resolve(__dirname, templateName);
  try {
    await copyFiles(templatePath, targetPath);
  } catch (err) {
    throw new Error(`Cloning failed:${err}`);
  }
};
