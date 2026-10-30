const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["build/", "migrations_old/"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "smart"],
      "no-return-await": "error",
      "require-atomic-updates": "off",
    },
  },
  {
    // These files use import/export syntax; Node loads them through require(esm).
    files: [
      "jobs/**/*.js",
      "queries/**/*.js",
      "utils/embeddings.js",
      "utils/middleware/requestRateLimiters.js",
    ],
    languageOptions: {
      sourceType: "module",
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: globals.jest,
    },
  },
];
