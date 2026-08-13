import js from "@eslint/js";
import globals from "globals";

/**
 * Foundry exposes these on `window` with no import. `foundry` is the namespace root; the
 * bare document classes and `getDocumentClass`/`fromUuid` are the few v14 keeps global.
 */
const foundryGlobals = {
  CONFIG: "readonly",
  CONST: "readonly",
  Hooks: "readonly",
  game: "readonly",
  ui: "readonly",
  canvas: "readonly",
  foundry: "readonly",
  Handlebars: "readonly",
  fromUuid: "readonly",
  getDocumentClass: "readonly",
  Actor: "readonly",
  Item: "readonly",
  ChatMessage: "readonly",
  Combat: "readonly",
  Combatant: "readonly",
  CombatantGroup: "readonly",
  Roll: "readonly"
};

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...foundryGlobals }
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    rules: {
      // Sheet action handlers take (event, target) and often use neither.
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
      "no-prototype-builtins": "error",
      "no-var": "error",
      "no-empty": "error"
    }
  }
];
