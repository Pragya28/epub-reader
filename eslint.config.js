import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Use @phosphor-icons/react — the project's icon library (components.json).",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Boundary layer 2 (backend/tsconfig.json is layer 1): each folder restates the
  // base rules it still wants (no-restricted-imports doesn't merge across blocks)
  // plus its own forbidden imports. These are blocklists — "contracts/** allows
  // only zod + relative" and "api/** allows only ../backend/handlers/*" are
  // enforced as "blocks everything else we know of", not a true allowlist.
  {
    // Test files (src/tests/**, and __tests__/** colocated next to the code they
    // cover) legitimately use node:fs to load fixtures off disk — Vitest runs in
    // Node regardless of the jsdom environment. They're never bundled into the
    // PWA, so they're excluded from the node:* block below but still blocked
    // from backend/api.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/tests/**", "**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Use @phosphor-icons/react — the project's icon library (components.json).",
            },
          ],
          patterns: [
            {
              group: ["**/backend/**", "**/api/**", "node:*"],
              message:
                "src/ is frontend-only; backend code lives in backend/ and must not be imported here.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/tests/**/*.{ts,tsx}", "src/**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/backend/**", "**/api/**"],
              message:
                "src/ is frontend-only; backend code lives in backend/ and must not be imported here.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["backend/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "dexie",
              message:
                "dexie is client-side IndexedDB access; backend/ has no DOM and talks to Postgres via db.ts.",
            },
          ],
          patterns: [
            {
              group: ["**/src/**"],
              message:
                "backend/ has no DOM; import shared types from contracts/, not src/.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["contracts/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/src/**", "**/backend/**", "**/api/**", "node:*"],
              message:
                "contracts/ is shared by src/ and backend/; it may import zod and its own relative files only.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["api/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/src/**", "node:*"],
              message:
                "api/ files are one-line re-exports of ../backend/handlers/*; no other logic belongs here.",
            },
          ],
        },
      ],
    },
  },
]);
