import { defineConfig } from "eslint/config";
import expo from "eslint-config-expo/flat.js";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";

export default defineConfig([
  {
    ignores: [
      "dist/**",
      "dist-native/**",
      ".expo/**",
      ".local-artifacts/**",
      "graft/**",
      "marketing/**",
      "expo-env.d.ts",
    ],
  },
  expo,
  {
    rules: {
      // React Compiler is not enabled. Enforce hook ordering and dependency
      // safety without compiler-specific restrictions on our ownership refs
      // and effects that hydrate persisted drafts.
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      // Native Text renders apostrophes literally; it does not parse HTML.
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "eslint.config.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["supabase/functions/**/*.ts"],
    languageOptions: { globals: { ...globals.browser, Deno: "readonly" } },
    rules: { "import/no-unresolved": ["error", { ignore: ["^npm:"] }] },
  },
  prettier,
]);
