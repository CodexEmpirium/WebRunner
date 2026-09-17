import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    watch: {
      ignored: ["**/*smoke*.png", "**/.edge-smoke-profile/**", "**/.npm-cache/**"],
    },
  },
});
