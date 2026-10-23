# vortex-worklet

A thin, turbulent accretion disk crossing a circular black-hole shadow, with lensed upper/lower images, radial cooling, and a brighter approaching edge.

The silhouette draws on [NASA's black-hole accretion-disk visualization](https://svs.gsfc.nasa.gov/13326/). This painter uses bounded vector geometry to suggest those features; it is an artistic approximation, not a relativistic ray tracer. The colors remain art-directable through `--worklet-hue`.

Zero runtime dependencies. One self-contained paint module, a minified alternative, and an optional typed loader.

```sh
npm install vortex-worklet
```

## Load

For Vite:

```js
import { register, attachView } from "vortex-worklet/register";
import workletUrl from "vortex-worklet/worklet.js?url";

await register(workletUrl);
const cleanup = attachView(document.querySelector(".art"));
// Call cleanup() when removing the element.
```

For other build systems, copy `worklet.js` to a public asset and call `CSS.paintWorklet.addModule('/worklets/vortex.js')` after checking `globalThis.CSS?.paintWorklet`. Keep the native cursor and a static background fallback. `register(url?)` returns `Promise<boolean>`: false when unsupported or during SSR, true after loading, and a rejection for load failures. Repeated calls with the same URL are deduplicated; failures can be retried. A default URL works when the package directory structure is served intact; bundled apps should pass their asset URL explicitly.

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

@supports (background-image: paint(vortex)) {
	.art {
		background-image: paint(vortex);
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

| Property               | Default | Meaning                                      |
| ---------------------- | ------- | -------------------------------------------- |
| `--worklet-time`       | 0       | One loop is 0–1; animate a registered number |
| `--worklet-seed`       | 42      | Repeatable variation                         |
| `--worklet-hue`        | 225     | Base hue in degrees, clamped to -3600–3600   |
| `--worklet-intensity`  | 1       | 0–2 light multiplier                         |
| `--vortex-rings`       | 100     | 20–160 radial gas bands; rendering detail    |
| `--vortex-tilt`        | -8      | -60–60 degrees; screen rotation              |
| `--vortex-lensing`     | 0.9     | 0–1.5; light bending                         |
| `--vortex-radius`      | 1       | 0.3–1.3; disk scale                          |
| `--vortex-inclination` | 0.12    | 0.04–0.5; projected disk opening             |

Numeric values are finite and bounded; missing or malformed numeric values use defaults. Counts are integer-truncated unless stated otherwise. CSS colors should be valid explicit colors; Paint API `currentColor` does not resolve to the element's text color. Invalid colors follow the browser's Canvas style-assignment behavior.

## Browser support

Requires CSS Paint and a secure context (HTTPS or localhost); test `CSS.paintWorklet`. Chrome and Edge support it; provide a static fallback elsewhere. See [CSS Painting API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Painting_API). Rendering cost depends on dimensions, pixel ratio, and settings. Keep large animated surfaces and density modest on mobile.

The root entry retains the `worklet.js` URL convention. For a smaller asset use `vortex-worklet/worklet.min.js`. Loading multiple different URLs or versions that register the same paint name in one document is unsupported; use a single module URL per effect.

MIT © Emilio Domínguez.
