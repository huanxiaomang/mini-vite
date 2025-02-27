export * from "./logger";
export * from "./mime";
export * from "./file";

export const isObject = (val: unknown): val is object =>
  typeof val === "object" && val !== null;
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const isFunction = (val: unknown): val is Function =>
  typeof val === "function" && val !== null;
