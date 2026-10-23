# cursor-worklet

Six animated cursor materials: flowing silk ribbons, fiery comets, sculpted plasma, chromatic glass lenses, expanding ripples, and orbital halos.

Zero runtime dependencies. One self-contained paint module, a minified alternative, and an optional typed loader.

```sh
npm install cursor-worklet
```

## Load

For Vite:

```js
import { register } from "cursor-worklet/register";
import workletUrl from "cursor-worklet/worklet.js?url";

await register(workletUrl);
```

For other build systems, copy `worklet.js` to a public asset and call `CSS.paintWorklet.addModule('/worklets/cursor.js')` after checking `globalThis.CSS?.paintWorklet`. Keep the native cursor and a static background fallback. `register(url?)` returns `Promise<boolean>`: false when unsupported or during SSR, true after loading, and a rejection for load failures. Repeated calls with the same URL are deduplicated; failures can be retried. A default URL works when the package directory structure is served intact; bundled apps should pass their asset URL explicitly.

## Paint and animate

```css
@property --worklet-time {
	syntax: "<number>";
	inherits: false;
	initial-value: 0;
}

.art {
	min-height: 24rem;
	background-color: #080a10;
	background-image: linear-gradient(135deg, #182243, #33213d);
	--worklet-hue: 220;
}

@supports (background-image: paint(cursor)) {
	.art {
		background-image: paint(cursor);
		animation: worklet-loop 8s linear infinite;
	}
}

@keyframes worklet-loop {
	from {
		--worklet-time: 0;
	}
	to {
		--worklet-time: 1;
	}
}

@media (prefers-reduced-motion: reduce) {
	.art {
		animation: none;
	}
}
```

Register `--worklet-time` once in your document. Without an animation, the effect is a stable still image. The worklet does not own a timer or access the DOM. Pause animations when the surface is hidden.

## CSS inputs

| Property                   | Default                | Meaning                                            |
| -------------------------- | ---------------------- | -------------------------------------------------- |
| `--worklet-time`           | 0                      | One loop is 0–1; animate a registered number       |
| `--worklet-seed`           | 42                     | Repeatable variation                               |
| `--worklet-hue`            | 225                    | Base hue in degrees, clamped to -3600–3600         |
| `--worklet-intensity`      | 1                      | 0–2 light multiplier                               |
| `--cursor-ripples`         | 5                      | 0–24 rings                                         |
| `--cursor-size`            | 18                     | 0–250 CSS px                                       |
| `--cursor-border-size`     | 1                      | 0–20 CSS px; 0 disables outlines                   |
| `--cursor-fill-color`      | Hue-derived light blue | CSS color or legacy RGB triplet                    |
| `--cursor-stroke-color`    | Hue-derived pale blue  | CSS color or legacy RGB triplet                    |
| `--cursor-color-intensity` | 0.6                    | 0–1 opacity                                        |
| `--cursor-position-x`      | Element center         | Local CSS px, including zero                       |
| `--cursor-position-y`      | Element center         | Local CSS px, including zero                       |
| `--cursor-mode`            | rings                  | rings, orbit, ribbon, comet, plasma, or lens       |
| `--cursor-orbit`           | 1                      | 0.1–3 orbital size multiplier                      |
| `--cursor-glow`            | 1                      | 0–2 orbital bloom                                  |
| `--cursor-trail`           | Empty                  | Newest-first local x y pairs; up to 32 points      |
| `--cursor-speed`           | 0                      | 0–60; ribbon spread, normally set by attachPointer |
| `--cursor-press`           | 0                      | 0–1; material compression                          |
| `--cursor-twist`           | 1                      | 0–3; ribbon and plasma deformation                 |

Numeric values are finite and bounded; missing or malformed numeric values use defaults. Counts are integer-truncated unless stated otherwise. CSS colors should be valid explicit colors; Paint API `currentColor` does not resolve to the element's text color. Invalid colors follow the browser's Canvas style-assignment behavior.

## Browser support

Requires CSS Paint and a secure context (HTTPS or localhost); test `CSS.paintWorklet`. Chrome and Edge support it; provide a static fallback elsewhere. See [CSS Painting API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Painting_API). Rendering cost depends on dimensions, pixel ratio, and settings. Keep large animated surfaces and density modest on mobile.

The root entry retains the `worklet.js` URL convention. For a smaller asset use `cursor-worklet/worklet.min.js`. Loading multiple different URLs or versions that register the same paint name in one document is unsupported; use a single module URL per effect.

MIT © Emilio Domínguez.

## Pointer tracking

```js
import { attachPointer } from "cursor-worklet/register";

const cleanup = attachPointer(document.querySelector(".art"), { smoothing: 0.24, trail: 32 });
// On unmount or removal:
cleanup();
```

`attachPointer(element, { touch: true })` optionally follows touch pointers without preventing scrolling. Updates are batched with requestAnimationFrame and stop when the trail settles. Cleanup removes every listener, cancels queued writes, and restores all five prior inline properties, including their priorities. Reduced motion disables smoothing and history; hidden documents suspend updates. Positions use local CSS pixels and support axis-aligned scaling; rotated or skewed targets need your own coordinate mapping. The native cursor stays visible.

The default `rings` mode preserves the original concentric cursor and now explicitly expands/fades with `--worklet-time`. Choose `orbit`, `ribbon`, `comet`, `plasma`, or `lens` for the other materials. Every mode responds to the original `--cursor-position-x` and `--cursor-position-y` controls. Ribbon and comet modes use bounded pointer history; before interaction, they show a procedural animated tail. Pressing compresses the shape and changes its glow.

Pointer options: `smoothing` is the fraction covered per 60 Hz frame, bounded to 0.05–1 (default 1); `trail` is bounded to 2–32 history points (default 24). `touch` defaults to false. Lower smoothing makes the light follow more softly. The helper controls `--cursor-position-x`, `--cursor-position-y`, `--cursor-trail`, `--cursor-speed`, and `--cursor-press`; CSS controls the animation clock.
