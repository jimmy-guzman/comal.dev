import { defineConfig } from "@jimmy.codes/eslint-config";

const eslintConfig = defineConfig({
  ignores: ["**/components/{ui,ai-elements}/**", ".agents/**", ".claude/**"],
});

export default eslintConfig;
