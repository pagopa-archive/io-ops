module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: [
    "dist",
    "/node_modules",
    "schema" /* run tests for db schema separatedly*/,
  ],
};
