import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This codebase intentionally uses flexible typing in many places.
      "@typescript-eslint/no-explicit-any": "off",
      // These rules generate lots of false positives in UI code here.
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "off",
      "prefer-const": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "deploy/.next/**",
    "deploy/**",
    "release-extract/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/_deprecated/**",
  ]),
  {
    files: ["src/app/api/**/*.ts", "src/app/api/**/*.tsx"],
    rules: {
      // Keep route handlers permissive.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
