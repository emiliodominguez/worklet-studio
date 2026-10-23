# Documentation

| Guide                                     | Contents                                                      |
| ----------------------------------------- | ------------------------------------------------------------- |
| [Workspace architecture](architecture.md) | Package boundaries, build outputs and adding an effect        |
| [CodePen collection](codepens.md)         | Live Pens, source generation and API publishing               |
| [Releasing](releasing.md)                 | Batch npm releases, version conflicts and recovery            |
| [Migration](migration.md)                 | Compatibility with the original particles and cursor packages |
| [Visual design](design.md)                | Layout, materials, controls and motion                        |
| [Verification](verification.md)           | Recorded checks from previous revisions                       |

Each worklet's README in [`packages/`](../packages/) documents its installation, helpers and CSS properties. Start with the [root README](../README.md) for the live demos and npm links.

`codepens.json` records published Pen IDs and collection membership. `media/` contains real screenshots used by the README. Generated Pen files, local screenshots, logs and release reports belong in the ignored `artifacts/` directory.
