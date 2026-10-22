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
		],
	},
	{
		id: "cursor",
		name: "Cursor",
		subtitle: "At your fingertips.",
		description: "An orbital instrument that follows your hand. Interlocking ellipses, soft light, and a little gravity.",
		hint: "Move your pointer through the light",
		controls: [
			control("--cursor-ripples", "Orbits", 1, 14, 1, 7),
			control("--cursor-size", "Radius", 8, 65, 1, 32),
			control("--cursor-orbit", "Orbit", 0.3, 2, 0.05, 1),
			control("--cursor-glow", "Bloom", 0, 2, 0.05, 1),
		],
		presets: [
			{
				name: "Atom",
				values: {
					"--worklet-hue": 220,
					"--cursor-mode": "orbit",
					"--cursor-ripples": 7,
					"--cursor-size": 32,
					"--cursor-color-intensity": 0.8,
				},
			},
			{
				name: "Halo",
				values: {
					"--worklet-hue": 310,
					"--cursor-mode": "orbit",
					"--cursor-ripples": 3,
					"--cursor-size": 55,
					"--cursor-color-intensity": 0.9,
					"--cursor-glow": 1.7,
				},
			},
			{
				name: "Original",
				values: {
					"--worklet-hue": 210,
					"--cursor-mode": "rings",
					"--cursor-ripples": 5,
					"--cursor-size": 18,
					"--cursor-color-intensity": 0.35,
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
];
