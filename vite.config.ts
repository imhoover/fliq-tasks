import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
// https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: { strictPort: true },
});
