const paths: Record<string, string> = {
	caustics: '<path d="M2 8c3-5 5 5 8 0s5 5 8 0 4 0 4 0M2 16c3-5 5 5 8 0s5 5 8 0 4 0 4 0M8 2c-5 3 5 5 0 8s5 5 0 8m8-16c-5 3 5 5 0 8s5 5 0 8"/>',
	vortex: '<ellipse cx="12" cy="13" rx="10" ry="3" transform="rotate(-15 12 13)"/><path d="M7 12a5 7 0 1 1 10 0"/><circle cx="12" cy="12" r="2.5"/>',
	terrain: '<path d="M2 18c5 0 4-10 10-10s4 7 10 7M2 13c5 0 4-10 10-10s4 7 10 7M2 23c5 0 4-10 10-10s4 7 10 7"/>',
	ribbon: '<path d="M3 18C3 1 21 23 21 5M3 13C7-4 17 29 21 10M3 8c5-9 13 17 18 7"/>',
	comet: '<circle cx="17" cy="7" r="4"/><path d="m14 10-11 11m10-14-9 9m13-5-6 9"/>',
	plasma: '<path d="M12 2c3 4 8 1 8 6s4 7-1 10-6 6-10 2-8-2-7-7 6-7 10-11Z"/><circle cx="12" cy="12" r="4"/>',
	lens: '<circle cx="12" cy="12" r="9"/><path d="M6 11a6 6 0 0 1 5-5m7 7a6 6 0 0 1-5 5"/><circle cx="12" cy="12" r=".7"/>',
	orbit: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)"/>',
	rings: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
	aurora: '<path d="M3 16C4 3 20 3 21 10S5 22 3 10s16-8 18 7"/>',
	particles:
		'<circle cx="5" cy="6" r="1.4"/><circle cx="17" cy="4" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="4" cy="18" r="1.4"/><circle cx="20" cy="18" r="1.4"/><path d="m6 7 5 4m2 0 3-6M5 17l6-4m2 0 6 4"/>',
	cursor: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)"/><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(-35 12 12)"/>',
	"flow-field": '<path d="M3 5c5-4 6 8 12 4s6-3 6-3M3 11c5-4 6 8 12 4s6-3 6-3M3 17c5-4 6 8 12 4s6-3 6-3"/>',
	ripple: '<ellipse cx="12" cy="12" rx="10" ry="8"/><ellipse cx="12" cy="12" rx="6" ry="4.8"/><ellipse cx="12" cy="12" rx="2" ry="1.6"/>',
	iridescence: '<path d="m12 2 9 10-9 10L3 12 12 2Z"/><path d="m12 2 3 10-3 10-3-10 3-10ZM3 12h18"/>',
	arrow: '<path d="M6 18 18 6M6 6h12v12"/>',
	fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
	collapse: '<path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5"/>',
	code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/>',
	pause: '<path d="M8 5v14M16 5v14"/>',
	play: '<path d="m8 4 12 8-12 8V4Z"/>',
	copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
	shuffle: '<path d="M3 6h3c4 0 8 12 12 12h3M3 18h3c1 0 3-2 4-4m4-4c2-3 3-4 4-4h3m-3-3 3 3-3 3m0 6 3 3-3 3"/>',
	link: '<path d="m10 14 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2-2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
	reset: '<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
};

/** Render an inline SVG icon. @param name Icon key. @returns Decorative SVG hidden from assistive technology. */
export function icon(name: string): string {
	return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.aurora}</svg>`;
}

/** Render the studio's custom vector mark. @returns Decorative SVG markup. */
export function brandMark(): string {
	return '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false"><path d="M3 9c4-4 2 16 7 14 4-2 4-13 6-15-2 7-2 16 3 15 5-1 8-10 8-16" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
