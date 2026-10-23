# Release all worklets

The repository contains twelve public worklet packages. Core, the studio, and the root workspace are private. No publication happens during installation, building, testing, or dry runs.

## First release

From the repository root:

```sh
npm ci
npx playwright install chromium
npm run release:dry-run
npm login
npm run release:publish
```

Both release commands run TypeScript, unit tests, a production build, actual browser tests, and formatting checks before packing. The publish command authenticates against `https://registry.npmjs.org/`, checks access to existing names, and publishes the exact packed tarballs with public access. npm may request two-factor authentication interactively. Credentials remain in your npm configuration; the script does not collect or store them.

Create the intended source repository and add its real `repository`, `homepage`, and `bugs` URLs to package manifests so future users can find the code from npm. This checkout has no configured remote; the release script does not create one.

## Preview versions

```sh
npm run release:dry-run -- --tag next
npm run release:publish -- --tag next
```

Use appropriate new version numbers in each package manifest. Dist-tags do not permit replacing an existing version. The script defaults to `latest`; the direct command `node scripts/release.mjs` defaults to dry-run and expects already-built packages. Prefer the npm commands because they run the complete validation gate.

## Preflight and partial releases

Before uploading anything, the script packs every public `*-worklet` package and checks required files, package identity, registry metadata, immutable versions, and (in publish mode) account access. A missing package name is allowed; new names are not reserved and availability can change before the upload. Registry errors other than a package-not-found response stop the process.

An already-published version is skipped only when its registry integrity matches the local tarball exactly. An existing version with different contents stops the entire batch before publication; bump that package's version and rerun. A dry run rehearses `npm publish --dry-run` for every pending archive, but cannot guarantee that future authentication, token permissions, or name availability will succeed.

Publishing several npm packages is **not atomic**. The script publishes sequentially and stops on the first error. Each completed operation is recorded in `artifacts/releases/release-*/release.json` beside the exact tarballs. Fix the error and rerun from the same unchanged checkout: identical published tarballs will be skipped, and pending versions will continue. Changing any packed content after a partial release can require a version bump for packages already published. Keep the report and archives until the release is complete.

The script uses argument arrays, disables package lifecycle hooks when packing and publishing, fixes the registry to npm, and excludes private packages. Tests exercise dry-run defaults, version conflicts, registry errors, access checks, and partial publication. `npm run pack:check` additionally installs all tarballs into an isolated consumer and checks SSR imports.

Each worklet has no runtime dependencies: private core utilities are bundled into its output. No private infrastructure package needs publication.

See the official [npm publish documentation](https://docs.npmjs.com/cli/commands/npm-publish/) for authentication and registry behavior.
