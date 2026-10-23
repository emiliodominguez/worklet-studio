# kaleidoscope-worklet

Animated mirrored crystal facets with rotating layers, spectral seams, and traveling highlights.

Zero runtime dependencies. One self-contained paint module, a minified alternative, and an optional typed loader. This checkout contains an **unpublished 0.1.0 candidate**; install a locally packed tarball until this version is released.

## Load

For Vite:

```js
import { register, attachView } from "kaleidoscope-worklet/register";
import workletUrl from "kaleidoscope-worklet/worklet.js?url";

await register(workletUrl);
const cleanup = attachView(document.querySelector(".art"));
// Call cleanup() when removing the element.
```

For other build systems, copy `worklet.js` to a public asset and call `CSS.paintWorklet.addModule('/worklets/kaleidoscope.js')` after checking `globalThis.CSS?.paintWorklet`. Keep the native cursor and a static background fallback. `register(url?)` returns `Promise<boolean>`: false when unsupported or during SSR, true after loading, and a rejection for load failures. Repeated calls with the same URL are deduplicated; failures can be retried. A default URL works when the package directory structure is served intact; bundled apps should pass their asset URL explicitly.

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

@supports (background-image: paint(kaleidoscope)) {
	.art {
		background-image: paint(kaleidoscope);
		animation: worklet-loop 24s linear infinite;
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

Optional `attachView(element)` eases pointer lighting or parallax through `--worklet-pointer-x` and `--worklet-pointer-y` (0–1, centered at 0.5). It stops when settled, honors reduced motion, leaves touch scrolling intact, and returns cleanup that restores previous inline values. These properties can also be driven directly by your application.

## CSS inputs

| Property                  | Default | Meaning                                      |
| ------------------------- | ------- | -------------------------------------------- |
| `--worklet-time`          | 0       | One loop is 0–1; animate a registered number |
| `--worklet-seed`          | 42      | Repeatable variation                         |
| `--worklet-hue`           | 225     | Base hue in degrees, clamped to -3600–3600   |
| `--worklet-intensity`     | 1       | 0–2 light multiplier                         |
| `--kaleidoscope-segments` | 12      | 4–24; rotational symmetry                    |
| `--kaleidoscope-layers`   | 10      | 3–18; radial facet layers                    |
| `--kaleidoscope-twist`    | 1.2     | 0–3; layer rotation                          |
| `--kaleidoscope-radius`   | 1       | 0.4–1.4; crystal scale                       |

Numeric values are finite and bounded; missing or malformed numeric values use defaults. Counts are integer-truncated unless stated otherwise. CSS colors should be valid explicit colors; Paint API `currentColor` does not resolve to the element's text color. Invalid colors follow the browser's Canvas style-assignment behavior.

## Browser support

Requires CSS Paint and a secure context (HTTPS or localhost); test `CSS.paintWorklet`. Chrome and Edge support it; provide a static fallback elsewhere. See [CSS Painting API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Painting_API). Rendering cost depends on dimensions, pixel ratio, and settings. Keep large animated surfaces and density modest on mobile.

The root entry retains the `worklet.js` URL convention. For a smaller asset use `kaleidoscope-worklet/worklet.min.js`. Loading multiple different URLs or versions that register the same paint name in one document is unsupported; use a single module URL per effect.

MIT © Emilio Domínguez.
