import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // wasm-pack `--target web` output is loaded via its own init(); Vite serves
  // the .wasm as a static asset, so no wasm plugin is needed.
  server: { port: 5173 },
});
