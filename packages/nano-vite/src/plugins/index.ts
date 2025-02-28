import VueLoader from "./vue-loader";
import CSSLoader from "./css-loader";
import HTMLoader from "./html-loader";
import JSLoader from "./js-loader";
import TSLoader from "./ts-loader";
import ImgLoader from "./image-loader";
import type { PluginOption } from "../type";

export const defaultPlugins: PluginOption[] = [
  VueLoader,
  CSSLoader,
  HTMLoader,
  JSLoader,
  ImgLoader,
  TSLoader,
];

export * from "./css-loader";
export * from "./html-loader";
export * from "./js-loader";
export * from "./ts-loader";
export * from "./image-loader";
export * from "./vue-loader";
