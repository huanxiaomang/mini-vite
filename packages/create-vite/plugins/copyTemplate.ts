import path from "path";
import { Plugin } from "esbuild";
import { copyFiles, hasFolder, log } from "../../shared";
import { choices } from "../constants";

const copyPublicFiles: Plugin = {
  name: "copy-public-files",
  setup(build) {
    build.onStart(async () => {
      choices.forEach(async (c) => {
        const publicDir = path.resolve(__dirname, c.value);

        const distDir = path.resolve(__dirname, "../dist/");

        try {
          if (await hasFolder(publicDir)) {
            await copyFiles(publicDir, distDir);
            log.debug(`Copied ${publicDir} to ${distDir}`);
          } else {
            log.warn(`Directory ${publicDir} does not exist.`);
          }
        } catch (error) {
          console.error(`Error copying files: ${error}`);
        }
      });
    });
  },
};

export default copyPublicFiles;
