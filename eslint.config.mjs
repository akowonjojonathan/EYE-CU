import firebaseRulesPlugin from "@firebase/eslint-plugin-security-rules";

export default [
  {
    ignores: ["dist/**/*", "**/dist/**/*", "node_modules/**/*", "artifacts/**/*", "lib/**/*"],
  },
  firebaseRulesPlugin.configs["flat/recommended"],
];
