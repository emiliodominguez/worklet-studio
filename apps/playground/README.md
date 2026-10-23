# Playground

Two Vite entry points share the published worklet APIs:

| Entry                             | Purpose                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `index.html` and `src/main.ts`    | All effects, presets, live CSS controls and copyable recipes |
| `atrium.html` and `src/atrium.ts` | Full-screen architecture, camera tour and floor separation   |

`src/catalog.ts` defines effect descriptions, controls and presets. `src/icons.ts` supplies SVG icons. Each page has its own SCSS module.

From the repository root:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`, or `/atrium.html` for the building. The root command runs the package watchers as well as Vite.

`npm run build` produces `apps/playground/dist/`. Relative asset URLs support deployment under the GitHub Pages repository path. The demo imports workspace package loaders and standalone painter URLs; rendering logic belongs in `packages/`.

See the [workspace guide](../../docs/architecture.md) for adding an effect and the [CodePen guide](../../docs/codepens.md) for exporting demos.
