# Contributing

Rendering bugs, new effects and small, focused improvements are welcome.

For bugs, include your browser version, device, effect name, CSS properties and a short reproduction. A screenshot or recording helps with visual problems. For effect ideas, describe the motion or material you want and link a visual reference if you have one.

## Local setup

Use Node 24 and npm. From the repository root:

```sh
npm ci
npx playwright install chromium
npm run dev
```

The studio runs at `http://127.0.0.1:4173`. The atrium is at `/atrium.html`.

See the [workspace guide](docs/architecture.md) for the package layout and steps for adding an effect. The [documentation index](docs/README.md) links the release and migration guides.

## Before a pull request

```sh
npm run format
npm run check
npm run pack:check
```

Keep a worklet deterministic for the same CSS inputs. Bound geometry, particles and sampling costs. Preserve reduced motion, keyboard access and a fallback for browsers without CSS Paint. New packages should have no runtime dependencies and include a README with their CSS properties.

Use TypeScript, function declarations, concise JSDoc, tabs with width 4 and the repository's Prettier configuration. Use SVG for icons and conventional commit messages such as `feat: add a new ripple mode`.

Describe the visible change and how you checked it. Include before and after captures for rendering changes. Do not publish packages as part of a pull request.
