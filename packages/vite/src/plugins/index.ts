import transformVue from "./transform-vue";
import transformCSS from "./transform-css";
import transformHTML from "./transform-html";
import transformJS from "./transform-js";
import transformPNG from "./transform-png";
import transformSVG from "./transform-svg";
import transformTS from "./transform-ts";
import type { PluginOption } from "../type";

export const defaultPlugins: PluginOption[] = [
  transformCSS,
  transformHTML,
  transformJS,
  transformPNG,
  transformSVG,
  transformTS,
  transformVue,
];

export * from "./transform-css";
export * from "./transform-html";
export * from "./transform-js";
export * from "./transform-png";
export * from "./transform-svg";
export * from "./transform-ts";
export * from "./transform-vue";
