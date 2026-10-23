# Workspace architecture

Worklet Studio uses npm workspaces and Turborepo. Public packages provide the painters and optional interaction helpers. The playground imports those packages and supplies the controls around them.

## Package boundaries

| Location              | Responsibility                                                                    | Published to npm |
| --------------------- | --------------------------------------------------------------------------------- | ---------------- |
| `packages/*-worklet/` | One effect, its loader, optional interaction helper and public types              | Yes              |
| `packages/core/`      | Shared numeric inputs, noise, surface lighting, registration and pointer behavior | No               |
| `apps/playground/`    | The studio, atrium page, controls, recipes and presentation                       | No               |

Painters never import playground code or access the DOM. They render from geometry and CSS inputs. Browser interaction belongs in a loader's optional helper; UI state belongs in the playground. Core utilities are bundled into each public package, which keeps the installed packages free of runtime dependencies.

## A worklet package

| File                | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `src/worklet.ts`    | Declares CSS inputs and registers the paint name            |
| `src/renderer.ts`   | Implements the drawing logic                                |
| `src/register.ts`   | Exposes the SSR-safe loader and optional interaction helper |
| `src/register.d.ts` | Defines the published loader API                            |
| `README.md`         | Installation, examples, CSS properties and limits           |
| `package.json`      | npm identity, exports, packed files and source links        |
| `LICENSE`           | License included in the npm tarball                         |

Larger effects split their internals by responsibility. Architecture uses `geometry.ts`, `scene.ts` and `interaction.ts`; cursor uses `trails.ts`; metaballs uses `contours.ts`.

The shared build script creates `worklet.js`, `worklet.min.js`, `dist/register.js` and `dist/register.d.ts`. Those generated files are ignored by Git and included by npm's `files` allowlist. Preserve the public declarations when changing a helper's implementation.

## Build and development

Run commands from the repository root:

```sh
npm ci
npm run dev
```

Turborepo starts each worklet's builder in watch mode alongside Vite. The playground has two HTML entry points: `index.html` for the studio and `atrium.html` for the full-screen building. Vite imports painter bundles with `?url`, so the browser loads each as a separate worklet module.

TypeScript resolves `*-worklet/register` directly to workspace source for every package. Type checking therefore works on a fresh installation without generated declarations. Production builds and isolated tarball checks still validate the published package layout.

## Add an effect

1. Create `packages/<name>-worklet/` using the file layout above. Give it a distinct npm name, paint name, README and license.
2. Add the private core workspace as a development dependency if shared utilities are needed. Keep runtime dependencies empty.
3. Use `node ../../scripts/build-package.mjs` for the build, with `--watch` for development. Use an existing package's exports and packed-file allowlist.
4. Add the workspace dependency and asset import to the playground. Define the controls and presets in `apps/playground/src/catalog.ts`, and add its SVG icon in `icons.ts`.
5. Add the painter to `tests/painters.test.ts` and the effect to `tests/browser/studio.spec.ts`. Add focused tests for new geometry or interaction behavior.
6. Run `npm run check` and `npm run pack:check`. Update the root package table and changelog.

The batch release script discovers public `*-worklet` packages. CodePen generation uses the playground catalog and each package's version. Publish that npm version before creating its Pen. Specialized demos belong in `scripts/codepens/`; architecture reuses the atrium page's source instead of maintaining another renderer.

## Generated files and original sources

| Location                                    | Handling                                                         |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `apps/playground/dist/`                     | Generated site deployed by GitHub Pages                          |
| `packages/*/dist/` and root worklet bundles | Generated npm contents                                           |
| `artifacts/`                                | Ignored Pen files, release archives, reports and local captures  |
| `test-results/` and `playwright-report/`    | Ignored browser-test output                                      |
| `docs/media/`                               | Selected screenshots intentionally tracked for documentation     |
| `recovery/`                                 | Original npm sources and archives, retained without reformatting |

GitHub's Verify workflow runs the checks and isolated package installation. Deploy playground builds the site and publishes it to Pages on `main`. Both workflows can also be started manually.
