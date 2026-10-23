# Visual design

The live paint effect takes most of the screen. Controls, presets and source examples stay close to it. The studio contains thirteen effects and forty-six presets; architecture is the opening effect.

## Studio

The interface uses an ink background, slate panels, pale text and restrained periwinkle accents. Saturated color comes from the painters. Use system fonts for controls and monospace for CSS and code.

Effect navigation sits above the painted surface. Desktop controls sit beside it; smaller screens place controls underneath. Cursors have a separate preset shelf so their different materials are easy to find. All icons are SVG.

Every control changes a real CSS input. Presets should change composition or behavior as well as hue. Recipes include the package loader and the appropriate interaction helper.

## Atrium

The dedicated atrium page fills the viewport with one painted background. Navigation stays at the top, with the title and controls along the bottom. The architecture uses concrete galleries, suspended walkways, stair treads, a bronze ring and a reflecting pool.

Daylight, late afternoon and night change the lighting. The camera follows a constrained path through the building. Floor separation pulls the camera outside so the gallery structure remains visible. The tour uses CSS animation; the npm helper supplies pointer and keyboard navigation.

## Materials

| Effect       | Visual cues                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Cursor       | Distinct ripple, orbit, silk, comet, plasma and glass silhouettes; bounded pointer trails and press compression |
| Aurora       | Folded ribbons, bright fiber cores and softer surrounding light                                                 |
| Caustics     | Curved cells of focused light beneath blue water                                                                |
| Vortex       | A thin tilted disk, dark circular center, lensed arcs and hotter inner gas                                      |
| Terrain      | Contour lines, shaded ridges and occlusion                                                                      |
| Nebula       | Emission clouds, dark dust lanes and stars at different depths                                                  |
| Metaballs    | Merging silhouettes, reflected light and surface normals                                                        |
| Kaleidoscope | Mirrored crystal facets and traveling highlights                                                                |

The vortex is an illustration informed by [NASA's black hole visualization](https://svs.gsfc.nasa.gov/13326/). It is not a physical simulation. The same distinction applies to the atrium's lighting and reflections.

## Interaction and review

Keep keyboard focus visible, preserve touch scrolling, provide pause controls and honor reduced motion. Pause hidden surfaces. Browsers without CSS Paint receive a static fallback and an explanation.

Review both stationary and moving states. Look for banding, jagged silhouettes, clipped glow, excessive bloom and changes that are too subtle to notice. Check the full-screen experience as well as the smaller studio preview.

The images in `docs/media/` are captures of actual CSS Paint output. The effects do not use canvas elements, video or image sequences.
