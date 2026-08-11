import js from "@eslint/js";

export default [
  {
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        console: "readonly",
        process: "readonly"
      }
    }
  }
];