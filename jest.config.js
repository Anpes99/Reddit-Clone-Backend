module.exports = {
  testEnvironment: "node",
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  transform: {
    // Type checking is left to `npm run typecheck`, so tests stay fast
    "^.+\\.ts$": ["ts-jest", { diagnostics: false }],
  },
  // Let `require("./foo.js")` find foo.ts once a file is converted, like tsx does
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
