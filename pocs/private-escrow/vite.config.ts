import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const sdkDist = resolve(__dirname, "../../sdk/dist");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "starknet-sdk/dist/testing/mock-proving.js": resolve(
        sdkDist,
        "testing/mock-proving.js",
      ),
      "starknet-sdk/dist/internal/indexer-discovery.js": resolve(
        sdkDist,
        "internal/indexer-discovery.js",
      ),
      "starknet-sdk/dist/interfaces.js": resolve(sdkDist, "interfaces.js"),
      "starknet-sdk": resolve(sdkDist, "index.js"),
    },
  },
});
