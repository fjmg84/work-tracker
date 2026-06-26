import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const PORT = 5170;

export default defineConfig({
  plugins: [react()],
  root: "src",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: PORT,
  },
});
