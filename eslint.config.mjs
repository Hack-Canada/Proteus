import nextPlugin from "@next/eslint-plugin-next";

const flat = nextPlugin.flatConfig ?? nextPlugin.default?.flatConfig;

export default [flat.coreWebVitals];
