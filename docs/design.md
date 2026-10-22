# Worklet Studio

A live cabinet of optical experiments. The effect gets most of the screen; controls and code sit beside it like instruments in a light lab. No canvas element, video, or image assets in the showcase: actual CSS Paint API output.

Palette: ink #101219, slate #191d28, frost #f0f2fa, muted #9aa2b6, periwinkle #a9b9ff, coral #ffb1a8. The worklets supply saturated spectral color; the surrounding UI stays quiet.

Type: system sans for readable controls, a large tightly spaced sans headline, monospace only for actual CSS. Layout: compact navigation above a wide immersive stage, a narrow control column on desktop, controls beneath on mobile. Effect selection is a horizontal strip, not a grid of identical cards.

```
Worklet Studio                           About / Source recovery
Make CSS a little unreal.                9 paint experiments
[Aurora] [Particles] [Cursor] [Flow] [Ripples] [Iridescence] [Caustics] [Vortex] [Terrain]
[                                         ][ Effect + preset ]
[            Live painted surface         ][ Controls        ]
[                                         ][ Copy recipe     ]
[ Pause / full screen                     ][ CSS             ]
```

Review: dark framing is appropriate for light emission effects, but a generic neon dashboard would compete with them. Keep only the live surface colorful. Every control changes real paint inputs. Aurora is the opening artwork; presets must change composition as well as hue. Honor reduced motion, keyboard access, and unsupported browsers explicitly.

## Second visual pass

Keep the existing type, palette, SVG icon language, and quiet framing. Spend the extra detail in the paintings: crisp light cores inside soft bloom, tapered motion trails, layered depth, and coherent spectra. Cursor presets should differ in silhouette and behavior, not only hue. The six cursor forms are ripple, orbit, ribbon, comet, plasma, and lens; real pointer history and press input make them feel responsive. Add a visible cursor preset shelf above the stage so these variations are immediately discoverable.

New surfaces: animated water caustics, a tilted gravitational vortex, and luminous terrain contours. Review: avoid another generic rainbow wash. Caustics should read as refracted blue light, vortex as a disk with depth and a dark center, and terrain as elevation revealed by linework. Keep nine effect tabs wrapping on desktop and scrolling on mobile. No text-glyph icons.

## Vortex realism pass

The first vortex read as a folded sheet because a Gaussian deformation pulled the orbital lines into an elevated peak. Replace that construction with a thin foreground disk, a larger circular shadow, an upper lensed image and a compressed lower image. Use warm radial cooling, unequal brightness across the disk, and moving gas lanes. Keep the surrounding studio unchanged. The new disk-opening control separates foreshortening from screen rotation. [NASA's visualization](https://svs.gsfc.nasa.gov/13326/) provides the visual reference; the worklet remains a vector illustration rather than a physical simulation.
