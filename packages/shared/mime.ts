export const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".ts": "application/javascript",
  ".vue": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export const getMimeType = (ext: string): string =>
  MIME_TYPES[ext] || "application/octet-stream";

export const TEXT_EXTENSIONS = [
  ".html",
  ".js",
  ".ts",
  ".vue",
  ".css",
  ".json",
  ".svg",
];
export const BINARY_EXTENSIONS = [".png", ".jpg", ".jpeg"];
export const IMG_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg"];
export const CODE_EXTENSIONS = [".js", ".ts", ".vue", ".css"];
