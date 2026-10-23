# architecture-worklet

A concrete atrium rendered as a CSS background. Four gallery levels, suspended bridges, individually modeled stair treads, a bronze light sculpture, and a reflecting pool. The camera moves through the space; holding the pointer separates the floors and pulls the camera out to an architectural view.

The renderer uses perspective projection, near-plane clipping, surface lighting, atmospheric depth, roof-beam shadows, projected light volumes, depth-sorted dust, and a mirrored reflection pass. Everything is drawn with the CSS Paint API. No WebGL, Three.js, canvas elements, images or runtime dependencies.

Available on [npm](https://www.npmjs.com/package/architecture-worklet).

```sh
npm install architecture-worklet
```

## Load with Vite

```js
import { register, attachArchitecture } from "architecture-worklet/register";
import workletUrl from "architecture-worklet/worklet.js?url";

const element = document.querySelector(".atrium");

if (await register(workletUrl)) {
	const cleanup = attachArchitecture(element, { wheel: true });

	// Call cleanup() when removing the element.
}
```

```html
<div class="atrium" tabindex="0" aria-label="Explore the atrium"></div>
```

```css
@property --worklet-time {
	syntax: "<number>";
	inherits: false;
	initial-value: 0;
}

.atrium {
	min-height: 100svh;
	background-color: #16272b;
	background-image: linear-gradient(150deg, #768280, #16282c 65%);
	--architecture-daylight: 0.85;
	--architecture-travel: 0;
	--architecture-explode: 0;
}

@supports (background-image: paint(architecture)) {
	.atrium {
		background-image: paint(architecture);
		animation: atmosphere 48s linear infinite;
	}
}

@keyframes atmosphere {
	to {
		--worklet-time: 1;
	}
}

@media (prefers-reduced-motion: reduce) {
	.atrium {
		animation: none;
	}
}
```

For other build tools, serve the package's `worklet.js` as a static JavaScript asset and pass its URL to `register()`. The loader and worklet can also be served from a versioned npm CDN. The default `register()` URL works when the published `dist/` and root layout is preserved. `register()` returns false in unsupported browsers and during SSR; network errors reject and can be retried.

## Interaction

`attachArchitecture(element, options?)` returns an idempotent cleanup function. `attachView` is an alias for collection-wide tooling.

- Move the pointer to look around with eased parallax.
- Hold the primary pointer, or hold Space while the element has focus, to separate the building. Release to reassemble.
- Use the up and down arrow keys while the element has focus to move along the camera path.
- Set `{ wheel: true }` for a dedicated full-screen scene. Wheel navigation defaults to false so embedded previews preserve page scrolling. Browser pinch zoom is never intercepted.
- On touch screens, use a range input bound to `--architecture-travel`. Touch scrolling is preserved; a cancelled touch releases the building.

The helper stops scheduling frames when settled, suspends work on hidden documents, respects reduced motion, and restores previous inline properties on cleanup. Reduced motion disables pointer parallax and makes deliberate camera/separation changes immediate. Applications should pause their CSS animation while hidden or offscreen. The included full-screen experience handles document visibility and provides pause and reduced-motion controls.

## CSS controls

| Property                  | Default | Range and meaning                                        |
| ------------------------- | ------- | -------------------------------------------------------- |
| `--architecture-travel`   | `0`     | `0` to `1`, camera path from entrance to upper galleries |
| `--architecture-explode`  | `0`     | `0` to `1`, floor separation and exterior camera reveal  |
| `--architecture-daylight` | `0.85`  | `0` to `1`, night to full daylight                       |
| `--architecture-detail`   | `1`     | `0` to `1`, concrete seams, tie holes and grain          |
| `--worklet-time`          | `0`     | One seamless atmospheric cycle is `0` to `1`             |
| `--worklet-pointer-x`     | `0.5`   | `0` to `1`, horizontal look                              |
| `--worklet-pointer-y`     | `0.5`   | `0` to `1`, vertical look                                |
| `--worklet-intensity`     | `1`     | `0` to `2`, material exposure                            |
| `--worklet-seed`          | `42`    | Repeatable dust and water variation                      |
| `--worklet-hue`           | `225`   | Subtle ambient tint                                      |

Register any property you want to animate through CSS using `@property` with numeric syntax. Without an animation the building is a deterministic still image. The worklet has no DOM access or internal clock.

## Rendering limits

Requires CSS Paint in a secure context, currently available in Chrome and Edge. Provide a fallback and use feature detection. The geometry and dust budgets are bounded, back faces and offscreen polygons are culled, and fine concrete detail is skipped on small projected faces. The renderer uses a constrained camera path and a painter's depth sort, not a general-purpose scene engine or pixel depth buffer. Light volumes and material illumination are artistic approximations. Frame rate depends on device, surface size and pixel ratio.

Try the [full-screen atrium](https://emiliodominguez.github.io/worklet-studio/atrium.html). This package is discovered automatically by the monorepo's batch release script.

MIT © Emilio Domínguez.
