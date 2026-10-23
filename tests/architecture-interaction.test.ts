import assert from "node:assert/strict";
import { test } from "node:test";
import { attachArchitecture } from "../packages/architecture-worklet/src/interaction.ts";

/** Build a deterministic DOM event and animation-frame harness. @param reduced Reduced-motion preference. @returns Element, window, frame runner and event dispatcher. */
function harness(reduced = false) {
	const values = new Map<string, string>();
	const priorities = new Map<string, string>();
	const frames = new Map<number, FrameRequestCallback>();
	let identifier = 0,
		now = 0;
	const media = Object.assign(new EventTarget(), { matches: reduced });
	const view = Object.assign(new EventTarget(), {
		matchMedia() {
			return media;
		},
		getComputedStyle() {
			return element.style;
		},
		requestAnimationFrame(callback: FrameRequestCallback) {
			frames.set(++identifier, callback);
			return identifier;
		},
		cancelAnimationFrame(id: number) {
			frames.delete(id);
		},
	});
	const document = Object.assign(new EventTarget(), { defaultView: view, hidden: false });
	const element = Object.assign(new EventTarget(), {
		ownerDocument: document,
		clientHeight: 800,
		style: {
			getPropertyValue(name: string) {
				return values.get(name) || "";
			},
			getPropertyPriority(name: string) {
				return priorities.get(name) || "";
			},
			setProperty(name: string, value: string, priority = "") {
				values.set(name, value);
				priorities.set(name, priority);
			},
			removeProperty(name: string) {
				values.delete(name);
				priorities.delete(name);
			},
		},
		getBoundingClientRect() {
			return { left: 0, top: 0, width: 1000, height: 800 };
		},
	});
	/** Drain the animation queue with a hard limit to catch perpetual loops. */
	function settle() {
		for (let i = 0; frames.size && i < 300; i++) {
			const pending = [...frames.values()];
			frames.clear();
			now += 16.67;
			for (const callback of pending) callback(now);
		}
		assert.equal(frames.size, 0, "Interpolation must stop when settled");
	}
	/** Dispatch a synthetic DOM event. @param target Event target. @param type Event name. @param properties Event fields. @returns Dispatched event. */
	function dispatch(target: EventTarget, type: string, properties = {}) {
		const event = Object.assign(new Event(type, { cancelable: true }), properties);
		target.dispatchEvent(event);
		return event;
	}
	return { element, view, document, values, settle, dispatch, frames };
}

test("architecture: releasing unrelated UI input does not overwrite externally selected separation", function unrelatedRelease() {
	const h = harness();
	const cleanup = attachArchitecture(h.element as unknown as HTMLElement);
	h.values.set("--architecture-explode", "1");
	h.dispatch(h.view, "pointerup");
	h.settle();
	assert.equal(h.values.get("--architecture-explode"), "1");
	cleanup();
});

test("architecture: hold, release, camera easing and cleanup stop all scheduled work", function lifecycle() {
	const h = harness();
	h.element.style.setProperty("--architecture-travel", "0.3", "important");
	const cleanup = attachArchitecture(h.element as unknown as HTMLElement, { wheel: true });
	h.dispatch(h.element, "pointerdown", { isPrimary: true, button: 0, pointerId: 1, pointerType: "mouse", clientX: 900, clientY: 200 });
	h.settle();
	assert.equal(h.values.get("--architecture-explode"), "1.0000");
	assert.equal(h.values.get("--worklet-pointer-x"), "0.9000");
	h.dispatch(h.view, "pointerup");
	h.settle();
	assert.equal(h.values.get("--architecture-explode"), "0.0000");
	const zoom = h.dispatch(h.element, "wheel", { ctrlKey: true, deltaY: 100, deltaMode: 0 });
	assert.equal(zoom.defaultPrevented, false);
	h.dispatch(h.element, "wheel", { ctrlKey: false, deltaY: 100, deltaMode: 0 });
	h.settle();
	assert.equal(h.values.get("--architecture-travel"), "0.3450");
	cleanup();
	cleanup();
	assert.equal(h.values.get("--architecture-travel"), "0.3");
	assert.equal(h.element.style.getPropertyPriority("--architecture-travel"), "important");
	assert.equal(h.values.has("--architecture-explode"), false);
	h.dispatch(h.element, "pointermove", { clientX: 100, clientY: 200 });
	assert.equal(h.frames.size, 0);
});

test("architecture: reduced motion keeps the view still while intentional navigation remains available", function reducedMotion() {
	const h = harness(true);
	const cleanup = attachArchitecture(h.element as unknown as HTMLElement);
	h.dispatch(h.element, "pointermove", { clientX: 900, clientY: 200 });
	assert.equal(h.frames.size, 0);
	h.dispatch(h.element, "keydown", { key: "ArrowUp" });
	h.settle();
	assert.equal(h.values.get("--architecture-travel"), "0.0500");
	h.dispatch(h.element, "keydown", { code: "Space" });
	h.settle();
	assert.equal(h.values.get("--architecture-explode"), "1.0000");
	h.dispatch(h.view, "keyup", { code: "Space" });
	h.settle();
	assert.equal(h.values.get("--architecture-explode"), "0.0000");
	cleanup();
});
