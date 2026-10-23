# Verification

## Twelve-effect material and release revision

Verified on 2026-10-22 in `/Users/emilio.dominguez/Repos/worklet-studio` with Node 26.12.1, npm 11.20.0, and Playwright Chromium 156.0.8078.4. This revision adds nebula, metaballs, kaleidoscope, shaded materials across the collection, and optional pointer lighting/parallax.

- `npm run release:dry-run`: strict TypeScript, 57 unit tests, 13 build tasks, 11 browser tests, and formatting passed. All twelve exact package tarballs passed npm's dry run. The final report is in ignored `artifacts/releases/release-m7b3Ii/release.json`; the complete command output is `artifacts/release-dry-run.log`.
- `node scripts/check-packages.mjs`: all twelve regular and minified bundles registered; all twelve tarballs installed and imported in an isolated consumer; public registration and interaction helper exports were present.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npm run test:browser`: all eleven tests passed against the final production build. Output is in ignored `artifacts/production-tests.log`.
- `node scripts/visual-review.mjs`: captured and reviewed material surfaces, all eight cursor presets, a real moving silk trail, galaxy, deep water, blue shift, and terrain variations. Additional captures exercised all nine new-effect presets and 390px mobile layouts with no overflow, canvas elements, or page errors.

New regression coverage checks bounded view inputs for every non-cursor painter, continuous seeded noise, separate/merged/hollow implicit silhouettes, bounded surface sampling at extreme dimensions, pointer easing/recentering/cleanup, and reduced motion. Release tests cover default dry-run behavior, private-package exclusion, conflicting immutable versions, exact-integrity skips, ownership failures, registry failures, and stopping with a progress report after a partial release.

Visual review prompted interpolated scanlines, smooth liquid silhouette clipping, stronger depth ordering, reduced silk overexposure, and a smaller ribbon composition. A capture-only script initially timed out waiting for element stability; direct viewport-region captures completed, and the separate development and production browser suites both passed their element screenshots. A local Canvas 2D renderer diagnostic was used while tuning cost; it is not a measurement of actual worklet frame throughput or physical-device performance.

No npm package was uploaded, no remote repository was created, and no deployment was performed. The development studio remains available on port 4173 with all twelve package watchers.

## Earlier nine-effect revisions

Verified locally on 2026-10-22 in `/Users/emilio.dominguez/Repos/worklet-studio`, including the second visual pass: nine painters, six cursor materials, bounded pointer trails, and the responsive cursor preset picker.

Environment: Node 26.5.0, npm 12.1.0, Playwright Chromium 156.0.8078.4. CI is configured for Node 24 on Linux but has not been run remotely.

| Command                                                          | Observed result                                                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                  | TypeScript passed; 38 unit tests passed; all 10 Turborepo build tasks passed; 10 browser tests passed; formatting passed                    |
| `node scripts/check-packages.mjs` after build                    | All nine regular/minified bundles registered; tarballs contained required files; all nine installed and imported in an isolated application |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npm run test:browser` | All 10 browser tests passed against the production Vite preview, including the final cursor focus and vortex framing adjustments            |
| `npm run format:check` and `git diff --check`                    | Passed                                                                                                                                      |
| `shasum recovery/*.tgz`                                          | Both archives matched the npm registry SHA-1 values recorded in recovery/README.md                                                          |

Browser checks compare painted output with a blank surface, verify changes between two animation times, exercise presets, ranges, reset, clipboard, shared URLs, pointer cleanup when switching effects, mobile overflow, reduced motion, unsupported-browser fallback, module network failures, and the original cursor ring animation without pointer movement. Additional checks cover distinct cursor silhouettes, preset selection and retained focus, bounded finite pointer history, pressure release outside the surface, and direct tracking under reduced motion.

Desktop and mobile screenshots in ignored `artifacts/` were visually inspected. `node scripts/visual-review.mjs` captures the six cursor materials, moving silk trails, new surfaces, galaxy, and composition-changing presets in `artifacts/iteration/`. Visual review prompted continuous curved caustics instead of sampled contours, finer foil highlights, and more room around the vortex's upper arc. The mobile cursor shelf wraps into two rows without page overflow.

No npm publication, remote GitHub repository, or production deployment was performed. Firefox and Safari are handled through feature detection and static fallback, not a claimed paint polyfill. Performance is bounded by input limits but has not been benchmarked across physical devices.

Vortex realism revision: the 38 unit tests and 10 browser tests pass with the revised disk and lensed-image geometry. An additional local Playwright check compared two animation times for all three vortex presets, exercised both disk-opening limits, and checked a 390px mobile viewport with reduced motion. No page or console errors were observed. Desktop preset, maximum-opening, and mobile captures in `artifacts/vortex-*.png` were visually inspected; review also removed a visible brightness seam between the two disk halves. The updated package passed the same isolated tarball installation check.
