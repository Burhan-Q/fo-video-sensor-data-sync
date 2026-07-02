import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Map of bare imports -> runtime globals the FiftyOne app exposes for plugins
// (see app/packages/plugins/src/externalize.ts). Externalizing these keeps the
// plugin bundle small and, critically, makes it share the app's single instance
// of React/recoil/@fiftyone packages.
const externals: Record<string, string> = {
  react: "React",
  "react-dom": "ReactDOM",
  recoil: "recoil",
  "@fiftyone/state": "__fos__",
  "@fiftyone/playback": "__fopb__",
  "@fiftyone/operators": "__foo__",
  "@fiftyone/plugins": "__fop__",
};

// Bundled deps (Plotly, VOODO) reference `process.env` / `process.*` and
// `global`, which don't exist in a browser. FiftyOne loads the plugin as a
// plain <script>, so it gets none of the app's build-time defines — without
// this the bundle throws `process is not defined` at load and never registers
// the component ("Unsupported view"). Define NODE_ENV for the production code
// paths and inject a tiny runtime shim for the remaining `process`/`global`
// refs.
const SHIM_BANNER =
  "globalThis.global=globalThis.global||globalThis;" +
  "globalThis.process=globalThis.process||{env:{NODE_ENV:'production'}," +
  "nextTick:function(f){Promise.resolve().then(f)},platform:'',version:''," +
  "versions:{},argv:[]};";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cssInjectedByJsPlugin()],
  resolve: {
    alias: {
      // VOODO is precompiled with the automatic JSX runtime; the FiftyOne
      // App only exposes the classic React global. The shim delegates
      // jsx/jsxs to React.createElement so we don't bundle React twice.
      "react/jsx-runtime": resolve(__dirname, "src/js/jsx-runtime-shim.ts"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    minify: true,
    lib: {
      entry: resolve(__dirname, "src/js/index.tsx"),
      name: "VideoSensorDataSync",
      // IIFE (not UMD): FiftyOne loads the bundle via a plain <script> tag,
      // so it must self-execute and call registerComponent immediately. A UMD
      // build defers to the AMD branch when a `define.amd` loader is present
      // (registerComponent never runs -> "Unsupported view"). IIFE always runs
      // and reads the externalized @fiftyone globals inline. Keep the
      // index.umd.js filename so the default js_bundle path still resolves.
      fileName: () => "index.umd.js",
      formats: ["iife"],
    },
    rollupOptions: {
      external: Object.keys(externals),
      output: {
        globals: externals,
        inlineDynamicImports: true,
        banner: SHIM_BANNER,
      },
    },
  },
});
