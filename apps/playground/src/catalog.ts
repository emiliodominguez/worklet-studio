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
		id: "aurora",
		name: "Aurora",
		subtitle: "Light, folded.",
		description: "A sculpture made of a hundred luminous threads. Every strand follows the same invisible current.",
		hint: "Try a different fold count",
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
		description: "A drifting constellation of light. Nearby stars find each other, drawing a delicate, living network.",
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
					"--particles-count": 500,
					"--particles-lines-threshold": 34,
					"--particles-size-max": 2.5,
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
		description: "Hundreds of fine streamlines reveal an invisible magnetic field. Follow the currents as they bend around its center.",
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
		description: "Overlapping wavefronts turn into a liquid interference pattern. Change the sources and watch a new geometry emerge.",
		hint: "Move your pointer to shift the wave sources",
		controls: [
			control("--ripple-rings", "Wavefronts", 10, 90, 1, 55),
			control("--ripple-distortion", "Distortion", 0, 1.5, 0.05, 0.6),
			control("--ripple-sources", "Sources", 1, 4, 1, 2),
		],
		presets: [
			{ name: "Interference", values: { "--worklet-hue": 215, "--ripple-sources": 2, "--ripple-distortion": 0.6 } },
			{ name: "Mercury", values: { "--worklet-hue": 280, "--ripple-sources": 1, "--ripple-distortion": 1.4, "--ripple-rings": 80 } },
			{ name: "Resonance", values: { "--worklet-hue": 45, "--ripple-sources": 3, "--ripple-distortion": 0.15, "--ripple-rings": 42 } },
		],
	},
	{
		id: "iridescence",
		name: "Iridescence",
		subtitle: "Color with no fixed address.",
		description: "A spectral foil that catches imaginary light. Fine ridges and shifting color make an ordinary surface feel almost physical.",
		hint: "Move your pointer to change the light",
		controls: [
			control("--iridescence-scale", "Scale", 0.3, 6, 0.1, 2.4),
			control("--iridescence-ridges", "Ridges", 0, 1, 0.05, 0.55),
			control("--iridescence-shimmer", "Shimmer", 0, 1, 0.05, 0.65),
			control("--iridescence-metallic", "Metallic", 0, 1, 0.05, 0.65),
		],
		presets: [
			{ name: "Hologram", values: { "--worklet-hue": 215, "--iridescence-scale": 2.4, "--iridescence-shimmer": 0.65 } },
			{ name: "Pearl", values: { "--worklet-hue": 310, "--iridescence-scale": 0.7, "--iridescence-shimmer": 1, "--worklet-intensity": 1.5 } },
			{
				name: "Oil slick",
				values: { "--worklet-hue": 110, "--iridescence-scale": 4.8, "--iridescence-shimmer": 0.5, "--worklet-intensity": 0.8 },
			},
		],
	},
	{
		id: "caustics",
		name: "Caustics",
		subtitle: "Light beneath the surface.",
		description:
			"Moving water bends an invisible grid of light into bright, liquid seams. A little swimming-pool sunlight, wherever you need it.",
		hint: "Refraction bends the light",
		controls: [
			control("--caustics-density", "Light cells", 8, 42, 1, 24),
			control("--caustics-refraction", "Refraction", 0.1, 2, 0.05, 1),
			control("--caustics-depth", "Depth", 0, 1, 0.05, 0.7),
		],
		presets: [
			{ name: "Swimming pool", values: { "--worklet-hue": 195, "--caustics-density": 24, "--caustics-refraction": 1 } },
			{
				name: "Deep water",
				values: { "--worklet-hue": 220, "--caustics-density": 30, "--caustics-depth": 0.15, "--caustics-refraction": 1.6 },
			},
			{ name: "Liquid gold", values: { "--worklet-hue": 40, "--caustics-density": 18, "--caustics-depth": 0.4, "--caustics-refraction": 1.4 } },
		],
	},
	{
		id: "vortex",
		name: "Vortex",
		subtitle: "Even light falls.",
		description: "A tilted disk of luminous matter bends around a dark center. Fine orbital bands form an impossible little gravity well.",
		hint: "Lensing bends the far side of the disk",
		controls: [
			control("--vortex-rings", "Orbits", 20, 160, 1, 100),
			control("--vortex-lensing", "Lensing", 0, 1.5, 0.05, 0.9),
			control("--vortex-tilt", "Tilt", -60, 60, 1, -12),
			control("--vortex-radius", "Scale", 0.3, 1.3, 0.05, 1),
		],
		presets: [
			{ name: "Event horizon", values: { "--worklet-hue": 25, "--vortex-lensing": 0.9 } },
			{ name: "Blue shift", values: { "--worklet-hue": 205, "--vortex-lensing": 1.2, "--vortex-tilt": 18, "--vortex-rings": 140 } },
			{ name: "Saturn", values: { "--worklet-hue": 310, "--vortex-lensing": 0.15, "--vortex-tilt": -25, "--vortex-radius": 1.1 } },
		],
	},
	{
		id: "terrain",
		name: "Terrain",
		subtitle: "An imaginary landscape.",
		description: "A landscape described entirely in light. Layered contours rise, fold, and flow like an animated topographic print.",
		hint: "Elevation turns a flat field into a landscape",
		controls: [
			control("--terrain-lines", "Contours", 20, 150, 1, 90),
			control("--terrain-height", "Elevation", 0, 1.5, 0.05, 0.85),
			control("--terrain-complexity", "Complexity", 0.5, 5, 0.1, 2.2),
			control("--terrain-perspective", "Perspective", 0, 1, 0.05, 0.65),
		],
		presets: [
			{ name: "Contour", values: { "--worklet-hue": 170, "--terrain-height": 0.85 } },
			{ name: "Dunes", values: { "--worklet-hue": 10, "--terrain-height": 1.1, "--terrain-complexity": 1.1 } },
			{ name: "Digital alps", values: { "--worklet-hue": 245, "--terrain-height": 1.5, "--terrain-complexity": 3.5, "--terrain-lines": 120 } },
		],
	},
];
