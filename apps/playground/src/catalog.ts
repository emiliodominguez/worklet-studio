export interface Control {
	property: string;
	label: string;
	min: number;
	max: number;
	step: number;
	value: number;
}
export interface Preset {
	name: string;
	values: Record<string, string | number>;
}
export interface Experiment {
	id: string;
	name: string;
	subtitle: string;
	description: string;
	hint: string;
	controls: Control[];
	presets: Preset[];
}

/** Describe a numeric paint control. @param property CSS property. @param label Label. @param min Minimum. @param max Maximum. @param step Step. @param value Initial value. @returns Control metadata. */
function control(property: string, label: string, min: number, max: number, step: number, value: number): Control {
	return { property, label, min, max, step, value };
}

export const experiments: Experiment[] = [
	{
		id: "architecture",
		name: "Architecture",
		subtitle: "Enter the atrium.",
		description:
			"A concrete atrium with suspended bridges, staircases and a reflecting pool. Move to look around. Hold the pointer to separate the floors.",
		hint: "Move to look. Hold to pull it apart.",
		controls: [
			control("--architecture-travel", "Camera position", 0, 1, 0.01, 0),
			control("--architecture-daylight", "Daylight", 0, 1, 0.01, 0.85),
			control("--architecture-explode", "Separate floors", 0, 1, 0.01, 0),
			control("--architecture-detail", "Concrete detail", 0, 1, 0.1, 1),
		],
		presets: [
			{ name: "Late afternoon", values: { "--architecture-daylight": 0.85 } },
			{ name: "After hours", values: { "--architecture-daylight": 0.04, "--architecture-travel": 0.24 } },
			{ name: "Upper galleries", values: { "--architecture-travel": 0.62, "--architecture-daylight": 1 } },
			{ name: "Disassembled", values: { "--architecture-explode": 1, "--architecture-daylight": 0.92 } },
		],
	},
	{
		id: "aurora",
		name: "Aurora",
		subtitle: "Light, folded.",
		description: "Folded silk catches a moving light. A luminous skin, fine threads, and overlapping folds give the ribbon its depth.",
		hint: "Move to turn the light · try a different fold count",
		controls: [
			control("--aurora-ribbons", "Threads", 20, 180, 1, 110),
			control("--aurora-spread", "Spread", 0.05, 1.2, 0.01, 0.55),
			control("--aurora-folds", "Folds", 1, 6, 1, 2),
			control("--aurora-tilt", "Tilt", -90, 90, 1, -18),
		],
		presets: [
			{
				name: "Prism",
				values: { "--worklet-hue": 220, "--aurora-mode": "ribbon", "--aurora-folds": 2, "--aurora-spread": 0.55, "--aurora-tilt": -18 },
			},
			{
				name: "Solar silk",
				values: { "--worklet-hue": 55, "--aurora-mode": "ribbon", "--aurora-folds": 3, "--aurora-spread": 0.8, "--aurora-tilt": 20 },
			},
			{
				name: "Borealis",
				values: { "--worklet-hue": 165, "--aurora-mode": "curtain", "--aurora-folds": 2, "--aurora-spread": 1, "--aurora-tilt": -20 },
			},
		],
	},
	{
		id: "particles",
		name: "Particles",
		subtitle: "A small universe.",
		description:
			"A drifting constellation in deep space. Nearby stars link up, the closest blur into soft bokeh, and the brightest flare into diffraction spikes.",
		hint: "Increase reach to reveal the constellation",
		controls: [
			control("--particles-count", "Particles", 20, 500, 1, 180),
			control("--particles-lines-threshold", "Reach", 0, 220, 1, 115),
			control("--particles-size-max", "Size", 1, 6, 0.1, 2.4),
			control("--particles-drift", "Drift", 0, 120, 1, 35),
		],
		presets: [
			{
				name: "Constellation",
				values: {
					"--worklet-hue": 210,
					"--particles-background": "transparent",
					"--particles-count": 180,
					"--particles-lines-threshold": 115,
				},
			},
			{
				name: "Fireflies",
				values: {
					"--worklet-hue": 35,
					"--particles-background": "transparent",
					"--particles-count": 100,
					"--particles-lines-threshold": 0,
					"--particles-size-max": 4,
					"--particles-drift": 70,
				},
			},
			{
				name: "Neural",
				values: {
					"--worklet-hue": 265,
					"--particles-background": "transparent",
					"--particles-count": 320,
					"--particles-lines-threshold": 85,
					"--particles-size-max": 1.5,
				},
			},
			{
				name: "Spiral galaxy",
				values: {
					"--particles-layout": "galaxy",
					"--particles-background": "transparent",
					"--worklet-hue": 215,
					"--particles-count": 560,
					"--particles-lines-threshold": 0,
					"--particles-size-min": 0.4,
					"--particles-size-max": 1.7,
					"--particles-drift": 20,
				},
			},
		],
	},
	{
		id: "cursor",
		name: "Cursor",
		subtitle: "Leave a little light.",
		description: "Silk, fire, plasma, or glass. Six materials that follow your hand, trail through space, and compress under a press.",
		hint: "Move to draw · press to compress the light",
		controls: [
			control("--cursor-ripples", "Layers", 1, 14, 1, 7),
			control("--cursor-size", "Radius", 8, 90, 1, 38),
			control("--cursor-twist", "Twist", 0, 3, 0.05, 1),
			control("--cursor-glow", "Bloom", 0, 2, 0.05, 1),
		],
		presets: [
			{
				name: "Silk",
				values: {
					"--cursor-mode": "ribbon",
					"--worklet-hue": 205,
					"--cursor-size": 38,
					"--cursor-ripples": 8,
					"--cursor-color-intensity": 0.95,
					"--cursor-twist": 1.3,
				},
			},
			{
				name: "Comet",
				values: { "--cursor-mode": "comet", "--worklet-hue": 20, "--cursor-size": 32, "--cursor-color-intensity": 1, "--cursor-glow": 1.4 },
			},
			{
				name: "Original",
				values: {
					"--cursor-mode": "rings",
					"--worklet-hue": 210,
					"--cursor-ripples": 5,
					"--cursor-size": 18,
					"--cursor-color-intensity": 0.35,
				},
			},
			{
				name: "Plasma",
				values: {
					"--cursor-mode": "plasma",
					"--worklet-hue": 265,
					"--cursor-size": 58,
					"--cursor-color-intensity": 0.9,
					"--cursor-twist": 1.4,
				},
			},
			{
				name: "Glass",
				values: {
					"--cursor-mode": "lens",
					"--worklet-hue": 190,
					"--cursor-size": 52,
					"--cursor-color-intensity": 0.95,
					"--cursor-glow": 0.8,
				},
			},
			{
				name: "Atom",
				values: {
					"--cursor-mode": "orbit",
					"--worklet-hue": 220,
					"--cursor-size": 32,
					"--cursor-ripples": 7,
					"--cursor-color-intensity": 0.9,
				},
			},
			{
				name: "Afterglow",
				values: {
					"--cursor-mode": "ribbon",
					"--worklet-hue": 315,
					"--cursor-size": 55,
					"--cursor-ripples": 5,
					"--cursor-twist": 2.4,
					"--cursor-color-intensity": 1,
				},
			},
			{
				name: "Ember",
				values: {
					"--cursor-mode": "plasma",
					"--worklet-hue": 20,
					"--cursor-size": 42,
					"--cursor-twist": 0.7,
					"--cursor-color-intensity": 0.8,
				},
			},
		],
	},
	{
		id: "flow-field",
		name: "Flow field",
		subtitle: "Order in the current.",
		description: "Hundreds of silk streamlines reveal an invisible magnetic field. Near strands burn bright, far ones soften out of focus.",
		hint: "Turn up the vortex to bend the field",
		controls: [
			control("--flow-density", "Streams", 100, 1000, 10, 650),
			control("--flow-turbulence", "Turbulence", 0.2, 6, 0.1, 2.4),
			control("--flow-length", "Length", 8, 80, 1, 44),
			control("--flow-vortex", "Vortex", 0, 3, 0.05, 1),
		],
		presets: [
			{ name: "Magnetic", values: { "--worklet-hue": 180, "--flow-vortex": 1, "--flow-turbulence": 2.4 } },
			{ name: "Solar wind", values: { "--worklet-hue": 10, "--flow-vortex": 0.2, "--flow-turbulence": 1.4, "--flow-length": 65 } },
			{ name: "Singularity", values: { "--worklet-hue": 265, "--flow-vortex": 2.8, "--flow-turbulence": 4, "--flow-density": 900 } },
		],
	},
	{
		id: "ripple",
		name: "Ripples",
		subtitle: "Touch the surface.",
		description:
			"Spreading wavefronts cross and interfere, reflecting a dark photo studio. Clear water, liquid chrome, or molten gold, depending on the metal.",
		hint: "Move your pointer to shift the wave sources",
		controls: [
			control("--ripple-rings", "Wavefronts", 10, 90, 1, 55),
			control("--ripple-distortion", "Distortion", 0, 1.5, 0.05, 0.6),
			control("--ripple-sources", "Sources", 1, 4, 1, 2),
			control("--ripple-metal", "Metal", 0, 1, 0.05, 0.15),
		],
		presets: [
			{ name: "Interference", values: { "--worklet-hue": 215, "--ripple-sources": 2, "--ripple-distortion": 0.6, "--ripple-metal": 0.15 } },
			{
				name: "Mercury",
				values: { "--worklet-hue": 280, "--ripple-sources": 1, "--ripple-distortion": 1.4, "--ripple-rings": 80, "--ripple-metal": 1 },
			},
			{
				name: "Resonance",
				values: { "--worklet-hue": 36, "--ripple-sources": 3, "--ripple-distortion": 0.15, "--ripple-rings": 42, "--ripple-metal": 0.9 },
			},
		],
	},
	{
		id: "iridescence",
		name: "Iridescence",
		subtitle: "Color with no fixed address.",
		description:
			"Thin-film interference, computed per wavelength. Holographic foil splits the light into rainbows; pearl and oil films shift color as they thin and drain.",
		hint: "Move your pointer to change the light",
		controls: [
			control("--iridescence-scale", "Scale", 0.3, 6, 0.1, 2.4),
			control("--iridescence-ridges", "Ridges", 0, 1, 0.05, 0.55),
			control("--iridescence-shimmer", "Shimmer", 0, 1, 0.05, 0.65),
			control("--iridescence-metallic", "Metallic", 0, 1, 0.05, 0.65),
		],
		presets: [
			{
				name: "Hologram",
				values: {
					"--worklet-hue": 215,
					"--iridescence-film": "foil",
					"--iridescence-scale": 2.4,
					"--iridescence-shimmer": 0.65,
					"--iridescence-ridges": 0.55,
				},
			},
			{
				name: "Pearl",
				values: {
					"--worklet-hue": 330,
					"--iridescence-film": "pearl",
					"--iridescence-scale": 1.6,
					"--iridescence-shimmer": 0.8,
					"--iridescence-ridges": 0.9,
					"--worklet-intensity": 0.85,
				},
			},
			{
				name: "Oil slick",
				values: {
					"--worklet-hue": 110,
					"--iridescence-film": "oil",
					"--iridescence-scale": 4.8,
					"--iridescence-shimmer": 0.5,
					"--iridescence-ridges": 0.55,
					"--worklet-intensity": 1,
				},
			},
		],
	},
	{
		id: "caustics",
		name: "Caustics",
		subtitle: "Light beneath the surface.",
		description:
			"Sunlight refracted through a moving surface and folded into bright seams, with dispersion fringes and bloom. Swimming-pool light, wherever you need it.",
		hint: "Refraction bends the light",
		controls: [
			control("--caustics-density", "Light cells", 8, 42, 1, 24),
			control("--caustics-refraction", "Refraction", 0.1, 2, 0.05, 1),
			control("--caustics-depth", "Depth", 0, 1, 0.05, 0.7),
		],
		presets: [
			{
				name: "Swimming pool",
				values: {
					"--worklet-hue": 195,
					"--caustics-floor": "tiles",
					"--caustics-density": 24,
					"--caustics-refraction": 1,
					"--caustics-depth": 0.7,
				},
			},
			{
				name: "Deep water",
				values: {
					"--worklet-hue": 220,
					"--caustics-floor": "sand",
					"--caustics-density": 30,
					"--caustics-depth": 0.15,
					"--caustics-refraction": 1.6,
				},
			},
			{
				name: "Liquid gold",
				values: {
					"--worklet-hue": 40,
					"--caustics-floor": "none",
					"--caustics-density": 18,
					"--caustics-depth": 0.4,
					"--caustics-refraction": 1.4,
				},
			},
		],
	},
	{
		id: "vortex",
		name: "Vortex",
		subtitle: "Even light falls.",
		description:
			"Hot gas circles a black-hole shadow. Light from the far side wraps above and below it, while the approaching edge burns brighter.",
		hint: "Lensing bends the far side of the disk",
		controls: [
			control("--vortex-rings", "Detail", 20, 160, 1, 100),
			control("--vortex-lensing", "Lensing", 0, 1.5, 0.05, 0.9),
			control("--vortex-tilt", "Tilt", -60, 60, 1, -8),
			control("--vortex-inclination", "Disk opening", 0.04, 0.5, 0.01, 0.12),
			control("--vortex-radius", "Scale", 0.3, 1.3, 0.05, 1),
		],
		presets: [
			{ name: "Event horizon", values: { "--worklet-hue": 25, "--vortex-lensing": 0.9 } },
			{ name: "Blue shift", values: { "--worklet-hue": 205, "--vortex-lensing": 1.2, "--vortex-tilt": 18, "--vortex-rings": 140 } },
			{ name: "Ember disk", values: { "--worklet-hue": 18, "--vortex-lensing": 0.65, "--vortex-tilt": -18, "--vortex-inclination": 0.25 } },
		],
	},
	{
		id: "terrain",
		name: "Terrain",
		subtitle: "An imaginary landscape.",
		description: "Moonlit ridges fade into haze, mist settles in the valleys, and glowing contours trace every fold of the land.",
		hint: "Move to swing the light · raise the elevation",
		controls: [
			control("--terrain-lines", "Contours", 20, 150, 1, 90),
			control("--terrain-height", "Elevation", 0, 1.5, 0.05, 0.85),
			control("--terrain-complexity", "Complexity", 0.5, 5, 0.1, 2.2),
			control("--terrain-perspective", "Perspective", 0, 1, 0.05, 0.65),
		],
		presets: [
			{ name: "Contour", values: { "--worklet-hue": 170, "--terrain-height": 0.85 } },
			{ name: "Dunes", values: { "--worklet-hue": 10, "--terrain-height": 1.1, "--terrain-complexity": 1.1 } },
			{ name: "Digital alps", values: { "--worklet-hue": 245, "--terrain-height": 1.4, "--terrain-complexity": 2.9, "--terrain-lines": 110 } },
		],
	},
	{
		id: "nebula",
		name: "Nebula",
		subtitle: "Somewhere, stars are forming.",
		description:
			"Wispy sheets of glowing gas drift behind translucent dust lanes; the densest knots burn at the edges where a young star cluster lights them.",
		hint: "Dust carves shadows through the clouds",
		controls: [
			control("--nebula-clouds", "Density", 40, 240, 1, 160),
			control("--nebula-spread", "Spread", 0.3, 1.5, 0.05, 1),
			control("--nebula-stars", "Stars", 0, 260, 1, 140),
			control("--nebula-dust", "Dust", 0, 1, 0.05, 0.6),
		],
		presets: [
			{ name: "Orion", values: { "--worklet-hue": 220, "--nebula-clouds": 200 } },
			{ name: "Carina", values: { "--worklet-hue": 5, "--nebula-spread": 1.2, "--nebula-dust": 0.75 } },
			{ name: "Deep space", values: { "--worklet-hue": 170, "--nebula-spread": 0.65, "--nebula-stars": 230, "--nebula-dust": 0.8 } },
		],
	},
	{
		id: "metaballs",
		name: "Metaballs",
		subtitle: "A softer state of matter.",
		description:
			"Droplets of glass, chrome, or candy drift together, merge, and pull apart in a photo studio. Softboxes slide across every curve; light bends through the glass and pools on the floor.",
		hint: "Increase merging to join the droplets",
		controls: [
			control("--metaballs-count", "Droplets", 2, 9, 1, 5),
			control("--metaballs-size", "Size", 0.5, 1.5, 0.05, 1),
			control("--metaballs-merging", "Merging", 0.6, 1.6, 0.05, 1),
		],
		presets: [
			{ name: "Liquid glass", values: { "--worklet-hue": 185, "--metaballs-material": "glass", "--metaballs-count": 5 } },
			{
				name: "Lava lamp",
				values: {
					"--worklet-hue": 330,
					"--metaballs-material": "candy",
					"--metaballs-count": 4,
					"--metaballs-size": 1.1,
					"--metaballs-merging": 1.1,
				},
			},
			{
				name: "Quicksilver",
				values: {
					"--worklet-hue": 220,
					"--metaballs-material": "chrome",
					"--metaballs-count": 8,
					"--metaballs-size": 0.75,
					"--metaballs-merging": 0.7,
				},
			},
		],
	},
	{
		id: "kaleidoscope",
		name: "Kaleidoscope",
		subtitle: "Every turn, another world.",
		description:
			"Backlit glass shards, rods, and beads tumble in the object cell while mirrors fold them into a jewel. Every turn of the tube cuts a new one.",
		hint: "Change the symmetry to recut the crystal",
		controls: [
			control("--kaleidoscope-segments", "Symmetry", 4, 24, 1, 12),
			control("--kaleidoscope-layers", "Facets", 3, 18, 1, 10),
			control("--kaleidoscope-twist", "Twist", 0, 3, 0.05, 1.2),
			control("--kaleidoscope-radius", "Scale", 0.4, 1.4, 0.05, 1),
		],
		presets: [
			{ name: "Sapphire", values: { "--worklet-hue": 180, "--kaleidoscope-segments": 12 } },
			{
				name: "Cathedral",
				values: { "--worklet-hue": 15, "--kaleidoscope-segments": 8, "--kaleidoscope-layers": 14, "--kaleidoscope-twist": 2 },
			},
			{
				name: "Aperture",
				values: { "--worklet-hue": 260, "--kaleidoscope-segments": 6, "--kaleidoscope-layers": 8, "--kaleidoscope-twist": 2.7 },
			},
		],
	},
];
