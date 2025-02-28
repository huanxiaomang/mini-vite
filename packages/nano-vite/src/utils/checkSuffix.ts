import { relative } from "node:path";
import { fileExists, log, normalizeImportPath } from "@nano-vite/shared";
import { ROOT, possibleExtensions } from "../constant";
export async function checkSuffix(
  resolvedPath: string
): Promise<string | null> {
  const checkFns = possibleExtensions.map((suffix) =>
    new Promise<boolean>((resolve, reject) => {
      const guessedPath = `${resolvedPath}${suffix}`;
      log.debug(`Checking suffix: ${guessedPath}`);
      fileExists(guessedPath).then(
        (exists) => resolve(exists),
        (err) => reject(err)
      );
    }).then((exists) => ({
      exists,
      path: `${resolvedPath}${suffix}`,
    }))
  );

  const results = await Promise.allSettled(checkFns);

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.exists) {
      const normalizedPath = normalizeImportPath(
        relative(ROOT, result.value.path)
      );
      log.debug(`Found file: ${normalizedPath}`);
      return normalizedPath;
    }
  }

  log.debug(`No file found for ${resolvedPath} with any suffix`);
  return null;
}
