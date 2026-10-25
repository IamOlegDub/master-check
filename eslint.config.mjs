import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Rest destructuring drops fields before saving (e.g. the profile's pending email).
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
      // These effects sync with browser APIs and load data on mount (object URLs,
      // feature checks, Supabase requests), so a warning is enough.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Tests and build scripts are CommonJS by design.
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@next/next/no-assign-module-variable": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees created by the Kilo agent hold full copies of the project.
    ".kilo/**",
  ]),
]);

export default eslintConfig;
