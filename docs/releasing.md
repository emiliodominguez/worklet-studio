# Release procedure

Nothing is published automatically. This checkout has no remote by default.

1. Create the intended GitHub repository and add it as `origin`. Add its real `repository`, `homepage`, and `bugs` URLs to each package manifest before publication so the source is discoverable from npm.
2. Run `npm ci`, install Playwright Chromium, then run `npm run check` and `npm run pack:check`.
3. Inspect each package's README and packed files. Confirm ownership with `npm whoami` and `npm owner ls particles-worklet` / `npm owner ls cursor-worklet`.
4. Confirm availability of the four new names immediately before publishing. All four returned npm 404 when checked on 2026-10-22; that does not reserve them.
5. Review version numbers and changelog, then publish individual selected workspaces, for example `npm publish --workspace particles-worklet --access public`. Do not use an indiscriminate workspace publish: core and playground are private.
6. Tag the source revision and deploy `apps/playground/dist` to the chosen host. No production deploy or npm publish is part of local verification.

The nine worklet bundles contain no runtime imports. `@worklet-studio/core` is a private development dependency whose code is bundled into each package; consumers do not need it. Package tarball verification installs the published file set into a temporary application to catch workspace-only resolution mistakes.
