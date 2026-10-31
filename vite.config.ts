import { defineConfig, loadEnv, type PluginOption } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Explicit plugin list, previously wrapped by a hosted config package.
// Nitro runs on production builds only. Vercel gets its server output;
// everywhere else this stays a Node server for a VPS.
export default defineConfig(({ command, mode }) => {
  const loaded = loadEnv(mode, process.cwd(), "VITE_");
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(loaded)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const plugins: PluginOption[] = [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    ...tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
    react(),
  ];

  if (command === "build") {
    plugins.push(nitro({ preset: process.env.VERCEL ? "vercel" : "node-server" }));
  }

  return {
    define,
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      port: 5173,
    },
    plugins,
  };
});
