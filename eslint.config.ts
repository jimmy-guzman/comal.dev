import { defineConfig } from "@jimmy.codes/eslint-config";

const eslintConfig = defineConfig(
  {
    ignores: ["**/components/{ui,ai-elements,evilcharts}/**", ".agents/**", ".claude/**"],
  },
  {
    files: ["src/lib/errors.ts", "src/lib/memory.ts"],
    rules: { "unicorn/throw-new-error": "off" },
  },
);

export default eslintConfig;
