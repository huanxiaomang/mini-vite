import { log } from "@nano-vite/shared";
import type { RawSourceMap } from "source-map";

export async function withSourceMap(
  source: string,
  transformedCode: string,
  relativePath: string,
  map: RawSourceMap
): Promise<string> {
  try {
    const mapString = JSON.stringify(map);
    const mapBase64 = Buffer.from(mapString).toString("base64");

    const sourceMapComment = `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${mapBase64}`;

    const codeWithMap = transformedCode + sourceMapComment;

    log.debug(`Generated source map for ${relativePath}`);
    return codeWithMap;
  } catch (error) {
    log.error(`Error generating source map for ${relativePath}:`, error);
    return transformedCode;
  }
}
