import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

const isCloudflare = process.env.BUILD_TARGET === "cloudflare";

export default defineConfig({
  ssr: !isCloudflare,
  server: {
    preset: isCloudflare ? "static" : "node-server",
    rollupConfig: {
      external: isCloudflare ? [] : ["node:async_hooks"],
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      port: 3200,
      allowedHosts: true,
    },
  },
});
