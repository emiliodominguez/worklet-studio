# Repository scripts

Run the npm commands from the repository root. They select the right entry point and perform the required build steps.

| Command                    | Entry point                                       | Purpose                                                           |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `npm run build`            | `build-package.mjs`, through Turborepo            | Build standalone painters, loaders and the playground             |
| `npm run pack:check`       | `check-packages.mjs`                              | Pack all public worklets and install them in an isolated consumer |
| `npm run release:dry-run`  | `release.mjs`                                     | Validate and rehearse a batch npm release                         |
| `npm run release:publish`  | `release.mjs`                                     | Publish pending versions sequentially                             |
| `npm run codepens:prepare` | `codepens/prepare.mjs`                            | Generate formatted HTML, CSS and JavaScript using npm CDN imports |
| `npm run codepens:check`   | `codepens/prepare.mjs` and `codepens/publish.mjs` | Prepare and validate every Pen without API requests               |
| `npm run codepens:publish` | `codepens/publish.mjs`                            | Create missing Pens and add them to the collection                |

`codepens/atrium.mjs` adapts the full atrium page for CodePen. It reuses the playground's markup, styles and controls; the painter and navigation helper still come from npm.

`visual-review.mjs` is an optional capture tool for local rendering review. It writes to `artifacts/` and does not run as part of the standard verification command.

Generated files and progress reports belong in `artifacts/`. Published Pen IDs are recorded in `docs/codepens.json`. Keep credentials in environment variables or private files outside the repository.

See [releasing](../docs/releasing.md) and [CodePens](../docs/codepens.md) for publishing details.
