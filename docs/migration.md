# Migration from 1.0.0

The root `worklet.js` file and paint identifiers `particles` and `cursor` are preserved. Existing `CSS.paintWorklet.addModule(url)` integrations continue to work. New `/register` exports are optional and SSR-safe. Do not import the root entry to register a painter in the main window: registration belongs to the PaintWorklet global scope.

## Particles

All four original controls remain: `--particles-count`, `--particles-size-min`, `--particles-size-max`, and `--particles-lines-threshold`. The default background remains `#111`; use `--particles-background: transparent` to layer it over another background.

Particles now have usable defaults, stable seeded positions, coherent colors, and smooth motion driven by `--worklet-time`. Repainting no longer randomizes the image. Use `--worklet-seed` for a different arrangement. Connections are considered once per pair, capped at 64 forward candidates per particle, using spatial cells. Counts cap at 800; pathological dense configurations deliberately omit some edges to bound work.

## Cursor

All eight original controls remain, including zero-valued positions and comma-separated RGB fill/stroke colors. Standard CSS colors also work. `--cursor-mode: rings` is the default and retains the original concentric ripple appearance; its rings expand and fade when CSS animates `--worklet-time`. Add the registered numeric property and keyframes shown in the package README. Existing pointer-driven custom-property animation remains supported.

The new `--cursor-mode: orbit` paints luminous ellipses. `attachPointer(element)` batches updates once per animation frame, respects element scaling, skips touch by default, and returns a cleanup function that removes the listener, cancels a pending frame, and restores previous inline coordinate values. It never hides the native cursor. Axis-aligned scaling is supported; rotated/skewed elements need a custom coordinate transform.

Colors and exact layouts are intentionally refreshed. This is API compatibility, not a promise of pixel-identical 1.0.0 screenshots. Values outside documented limits are clamped, and missing/nonfinite numeric values fall back to safe defaults.
