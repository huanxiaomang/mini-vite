export interface Choice {
  title: string;
  value: string;
}

export const choices: Choice[] = [
  {
    title: "vanilla-js-template",
    value: "vite-js-template",
  },
  { title: "vue3-ts-template", value: "ts-vue-template" },
];

export const projGuideCommands: Record<string, string[]> = {
  "vanilla-js-template": ["cd $PATH", "pnpm i", "pnpm dev"],
  "ts-vue-template": ["cd $PATH", "pnpm i", "pnpm dev"],
} as const;
