import {
	executeCallbacks,
	isElement,
	type Callback,
	restoreTextSelection,
} from '$lib/internal/helpers';
import type { HTMLAttributes } from 'svelte/elements';
import { get, writable, type Writable } from 'svelte/store';

export type PointerType = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual' | null;

export type IPressEvent = {
	/** The type of press event being fired. */
	type: 'pressstart' | 'pressend' | 'pressup' | 'press';
	/** The pointer type that triggered the event. */
	pointerType: PointerType;
	/** The target element of the press event. */
	target: Element;
	/** Whether the shift keyboard modifier was held during the press event. */
	shiftKey: boolean;
	/** Whether the ctrl keyboard modifier was held during the press event. */
	ctrlKey: boolean;
	/** Whether the meta keyboard modifier was held during the press event. */
	metaKey: boolean;
	/** Whether the alt keyboard modifier was held during the press event. */
	altKey: boolean;
	/**
	 * By default, press events stop propogation to parent elements.
	 * In cases where a handler decides not to handle a specific event,
	 * it can call `continuePropagation()` to allow a parent to handle it
	 */
	continuePropagation(): void;
};

export type PressProps = PressEvents & {
	/** Whether the target is in a controlled press state */
	isPressed?: boolean;
	/** Whether the press events should be disabled */
	isDisabled?: boolean;
	/** Whether the target should not receive focus on press. */
	preventFocusOnPress?: boolean;
	/**
	 * Whether press events should be canceled when the pointer leaves the target while pressed.
	 * By default, this is `false`, which means if the pointer returns back over the target while
	 * still pressed, onPressStart will be fired again. If set to `true`, the press is canceled
	 * when the pointer leaves the target and onPressStart will not be fired if the pointer returns.
	 */
	shouldCancelOnPointerExit?: boolean;
	/** Whether text selection should be enabled on the pressable element. */
	allowTextSelectionOnPress?: boolean;
};

type PressState = {
	isPressed: boolean;
	ignoreEmulatedMouseEvents: boolean;
	ignoreClickAfterPress: boolean;
	didFirePressStart: boolean;
	isTriggeringEvent: boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	activePointerId: any;
	target: FocusableElement | null;
	isOverTarget: boolean;
	pointerType: PointerType;
	userSelect?: string;
	metaKeyEvents?: Map<string, KeyboardEvent>;
};

export type PressActionProps = PressProps & {
	/** A reference to the target element. */
	el?: Writable<Element>;
};

export type LongPressEvent = Omit<PressEvent, 'type' | 'continuePropagation'> & {
	/** The type of long press event being fired. */
	type: 'longpressstart' | 'longpressend' | 'longpress';
};

export type HoverEvent = {
	/** The type of hover event being fired. */
	type: 'hoverstart' | 'hoverend';
	/** The pointer type that triggered the hover event. */
	pointerType: PointerType;
	/** The target element of the hover event. */
	target: HTMLElement;
};

export type PressEvents = {
	/** Handler that is called when the press is released over the target. */
	onPress?: (e: PressEvent) => void;
	/** Handler that is called when a press interaction starts */
	onPressStart?: (e: PressEvent) => void;
	/**
	 * Handler that is called when a press interaction ends, either
	 * over the target or when the pointer leaves the target.
	 */
	onPressEnd?: (e: PressEvent) => void;
	/** Handler that is called when the press state changes. */
	onPressChange?: (isPressed: boolean) => void;
	/**
	 * Handler that is called when a press is released over the target, regardless
	 * of whether it started on the target or not.
	 */
	onPressUp?: (e: PressEvent) => void;
};

/** Any focusable element, including both HTML and SVG elements. */
export type FocusableElement = Element & HTMLOrSVGElement;

/** All DOM attributes supported across both HTML and SVG elements. */
export type DOMAttributes<T extends EventTarget = FocusableElement> = HTMLAttributes<T> & {
	id?: string | undefined;
	tabIndex?: number | undefined;
	style?: string | undefined;
	class?: string | undefined;
};

export type PressResult = {
	/** Whether the target is currently pressed.*/
	isPressed: boolean;
	/** Props to apply to the target. */
	pressProps: DOMAttributes;
};

export type EventBase = {
	currentTarget: EventTarget;
	shiftKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
};

class PressEvent implements IPressEvent {
	type: IPressEvent['type'];
	pointerType: PointerType;
	target: Element;
	shiftKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	#shouldStopPropagation = true;

	constructor(
		type: IPressEvent['type'],
		pointerType: PointerType | null,
		originalEvent: EventBase
	) {
		this.type = type;
		this.pointerType = pointerType;
		this.target = originalEvent.currentTarget as Element;
		this.shiftKey = originalEvent.shiftKey;
		this.metaKey = originalEvent.metaKey;
		this.ctrlKey = originalEvent.ctrlKey;
		this.altKey = originalEvent.altKey;
	}

	continuePropagation() {
		this.#shouldStopPropagation = false;
	}

	get shouldStopPropagation() {
		return this.#shouldStopPropagation;
	}
}

const LINK_CLICKED = Symbol('linkClicked');

export function createPress(props: PressActionProps): PressResult {
	const {
		onPress,
		onPressChange,
		onPressStart,
		onPressEnd,
		onPressUp,
		isDisabled,
		isPressed: isPressedProp,
		preventFocusOnPress,
		shouldCancelOnPointerExit,
		allowTextSelectionOnPress,
		el,
		...domProps
	} = props;

	const isPressed = writable(false);

	const state = writable<PressState>({
		isPressed: false,
		ignoreEmulatedMouseEvents: false,
		ignoreClickAfterPress: false,
		didFirePressStart: false,
		isTriggeringEvent: false,
		activePointerId: null,
		target: null,
		isOverTarget: false,
		pointerType: 'mouse',
	});

	const listeners: (() => void)[] = [];

	function removeAllListeners() {
		for (const listener of listeners) {
			listener();
		}
	}

	function startTriggeringEvent() {
		state.update((prev) => ({ ...prev, isTriggeringEvent: true }));
	}

	function stopTriggeringEvent() {
		state.update((prev) => ({ ...prev, isTriggeringEvent: false }));
	}

	function triggerPressStart(originalEvent: EventBase, pointerType: PointerType) {
		const $state = get(state);
		if (isDisabled || $state.didFirePressStart) return;

		let shouldStopPropagation = true;
		state.update((prev) => ({ ...prev, isTriggeringEvent: true }));
		if (onPressStart) {
			const event = new PressEvent('pressstart', pointerType, originalEvent);
			onPressStart(event);
			shouldStopPropagation = event.shouldStopPropagation;
		}

		if (onPressChange) {
			onPressChange(true);
		}

		state.update((prev) => ({
			...prev,
			isTriggeringEvent: false,
			didFirePressStart: true,
		}));
		isPressed.set(true);
		return shouldStopPropagation;
	}

	function triggerPressEnd(originalEvent: EventBase, pointerType: PointerType, wasPressed = true) {
		const $state = get(state);
		if (!$state.didFirePressStart) return;

		state.update((prev) => ({
			...prev,
			ignoreClickAfterPress: true,
			didFirePressStart: false,
			isTriggeringEvent: true,
		}));

		let shouldStopPropagation = true;
		if (onPressEnd) {
			const event = new PressEvent('pressend', pointerType, originalEvent);
			onPressEnd(event);
			shouldStopPropagation = event.shouldStopPropagation;
		}

		if (onPressChange) {
			onPressChange(false);
		}

		isPressed.set(false);

		if (onPress && wasPressed && !isDisabled) {
			const event = new PressEvent('press', pointerType, originalEvent);
			onPress(event);
			shouldStopPropagation = event.shouldStopPropagation;
		}

		stopTriggeringEvent();
		return shouldStopPropagation;
	}

	function triggerPressUp(originalEvent: EventBase, pointerType: PointerType) {
		if (isDisabled) return;

		if (onPressUp) {
			startTriggeringEvent();
			const event = new PressEvent('pressup', pointerType, originalEvent);
			onPressUp(event);
			stopTriggeringEvent();
			return event.shouldStopPropagation;
		}
		return true;
	}

	function cancel(e: EventBase) {
		const $state = get(state);
		if ($state.isPressed && isElement($state.target)) {
			if ($state.isOverTarget) {
				triggerPressEnd(createEvent($state.target, e), $state.pointerType, false);
			}
			state.update((prev) => ({
				...prev,
				isPressed: false,
				isOverTarget: false,
				activePointerId: null,
				pointerType: null,
			}));
			removeAllListeners();
			if (!allowTextSelectionOnPress) {
				restoreTextSelection($state.target);
			}
		}
	}

	function cancelOnPointerExit(e: EventBase) {
		if (shouldCancelOnPointerExit) {
			cancel(e);
		}
	}
}

function createEvent(target: FocusableElement, e: EventBase): EventBase {
	return {
		currentTarget: target,
		shiftKey: e.shiftKey,
		ctrlKey: e.ctrlKey,
		metaKey: e.metaKey,
		altKey: e.altKey,
	};
}
