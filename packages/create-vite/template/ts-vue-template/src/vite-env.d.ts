/// <reference types="lite-vite/client" />

declare module "*.txt" {
  const content: string;
  export default content;
}
