#!/usr/bin/env node
import { resolve } from "node:path";
import prompts from "prompts";
import picocolors from "picocolors";
import { log } from "@vite/shared";
import { cloneTemplateTo } from "./clone";
import { choices, projGuideCommands } from "./constants";

const bootstrap = async () => {
  welcome();
  const result = await prompts([
    {
      type: "text",
      name: "projectName",
      message: "请输入项目名称(输入.直接在当前目录创建):",
    },
    {
      type: "select",
      name: "projectSelect",
      message: "请选择项目类型:",
      choices,
      initial: 0,
    },
  ]);
  const targetPath = resolve(
    process.cwd(),
    result.projectName === "." ? "" : result.projectName
  );

  const repoName = result.projectSelect;
  await cloneTemplateTo(repoName, targetPath);
  successLog(repoName, result.projectName);
};
bootstrap();

function welcome() {
  const cat = `
⣿⣿⣿⠟⠛⠛⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⢋⣩⣉⢻⣿⣿
⣿⣿⣿⠀⣿⣶⣕⣈⠹⠿⠿⠿⠿⠟⠛⣛⢋⣰⠣⣿⣿⠀⣿⣿
⣿⣿⣿⡀⣿⣿⣿⣧⢻⣿⣶⣷⣿⣿⣿⣿⣿⣿⠿⠶⡝⠀⣿⣿
⣿⣿⣿⣷⠘⣿⣿⣿⢏⣿⣿⣋⣀⣈⣻⣿⣿⣷⣤⣤⣿⡐⢿⣿
⣿⣿⣿⣿⣆⢩⣝⣫⣾⣿⣿⣿⣿⡟⠿⠿⠦⠀⠸⠿⣻⣿⡄⢻
⣿⣿⣿⣿⣿⡄⢻⣿⣿⣿⣿⣿⣿⣿⣿⣶⣶⣾⣿⣿⣿⣿⠇⣼
⣿⣿⣿⣿⣿⣿⡄⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⣰⣿
⣿⣿⣿⣿⣿⣿⠇⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢀⣿⣿
⣿⣿⣿⣿⣿⠏⢰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢸⣿⣿
⣿⣿⣿⣿⠟⣰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⣿⣿
⣿⣿⣿⠋⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⣿⣿
⣿⣿⠋⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⢸⣿
    `;
  log.info(cat);
  log.info(`———————————————————————————————————————————————————`);
  log.info(picocolors.blue(`欢迎(●• ̀ω•́ )✧ 请创建你的项目`));
  log.info(`———————————————————————————————————————————————————`);
}

function successLog(repoName: string, path: string) {
  log.info(
    `${picocolors.green(`创建成功`)}${projGuideCommands[repoName]
      .map((c) => `\n     ${c}`.replaceAll("$PATH", path))
      .join("")}`
  );
}
