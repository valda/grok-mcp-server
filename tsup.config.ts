import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "cli/index.ts" },
  format: ["cjs"],
  target: "node18",
  outDir: "dist",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
