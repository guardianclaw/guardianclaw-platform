import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  outDir: "dist",
  target: "es2022",
  // Stripe Agent Toolkit is an optional peer — never bundle it.
  external: ["@stripe/agent-toolkit"],
  esbuildOptions(options) {
    options.logOverride = {
      "commonjs-variable-in-esm": "silent",
    };
  },
});
