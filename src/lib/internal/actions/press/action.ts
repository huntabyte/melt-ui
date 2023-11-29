import {
	executeCallbacks,
	isElement,
	type Callback,
	restoreTextSelection,
	isHTMLAnchorElement,
	isHTMLOrSVGElement,
	addEventListener,
} from '$lib/internal/helpers';
import type { HTMLAttributes } from 'svelte/elements';
import { derived, get, writable, type Writable } from 'svelte/store';

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
	currentTarget: EventTarget | null;
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

	function onKeyUp(e: KeyboardEvent) {
		const $state = get(state);

		if ($state.isPressed && isValidKeyboardEvent(e, $state.target)) {
			if (shouldPreventDefaultKeyboard(e.target as Element, e.key)) {
				e.preventDefault();
			}

			const target = e.target;
			if (!isElement(target) || !isHTMLOrSVGElement($state.target)) return;

			const shouldStopPropagation = triggerPressEnd(
				createEvent($state.target, e),
				'keyboard',
				$state.target.contains(target)
			);
			removeAllListeners();

			if (shouldStopPropagation) {
				e.stopPropagation();
			}

			// If a link was triggered with a key other than Enter, open the URL ourselves.
			// This means the link has a role override, and the default browser behavior
			// only applies when using the Enter key.
			if (
				e.key !== 'Enter' &&
				isHTMLAnchorElement($state.target) &&
				$state.target.contains(target) &&
				!e[LINK_CLICKED]
			) {
				// Store a hidden property on the event so we only trigger link click once,
				// even if there are multiple usePress instances attached to the element.
				e[LINK_CLICKED] = true;
				openLink(state.target, e, false);
			}

			state.isPressed = false;
			state.metaKeyEvents?.delete(e.key);
		} else if (e.key === 'Meta' && state.metaKeyEvents?.size) {
			// If we recorded keydown events that occurred while the Meta key was pressed,
			// and those haven't received keyup events already, fire keyup events ourselves.
			// See comment above for more info about the macOS bug causing this.
			let events = state.metaKeyEvents;
			state.metaKeyEvents = null;
			for (let event of events.values()) {
				state.target.dispatchEvent(new KeyboardEvent('keyup', event));
			}
		}
	}

	const handlers = {
		onKeyDown(e: KeyboardEvent) {
			const currentTarget = e.currentTarget;
			const target = e.target;
			if (!isHTMLOrSVGElement(currentTarget) || !isHTMLOrSVGElement(target)) return;
			const $state = get(state);

			if (isValidKeyboardEvent(e, currentTarget) && currentTarget.contains(target)) {
				if (shouldPreventDefaultKeyboard(target, e.key)) {
					e.preventDefault();
				}

				// If the event is repeating, it may have started on a different element
				// after which focus moved to the current element. Ignore these events and
				// only handle the first key down event.
				let shouldStopPropagation = true;
				if (!$state.isPressed && !e.repeat) {
					state.update((prev) => ({
						...prev,
						target: currentTarget,
						isPressed: true,
						shouldStopPropagation: triggerPressStart(e, 'keyboard'),
					}));

					const listener = addEventListener(document, 'keyup', onKeyUp);
					listeners.push();
				}
			} else if (e.key === 'Meta') {
				state.update((prev) => ({ ...prev, metaKeyEvents: new Map() }));
			}
		},
	};
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

function isValidKeyboardEvent(event: KeyboardEvent, currentTarget: EventTarget | null): boolean {
	const { key, code } = event;
	const element = currentTarget as HTMLElement;
	const role = element.getAttribute('role');
	// Accessibility for keyboards. Space and Enter only.
	// "Spacebar" is for IE 11
	return (
		(key === 'Enter' || key === ' ' || key === 'Spacebar' || code === 'Space') &&
		!(
			(element instanceof HTMLInputElement && !isValidInputKey(element, key)) ||
			element instanceof HTMLTextAreaElement ||
			element.isContentEditable
		) &&
		// Links should only trigger with Enter key
		!((role === 'link' || (!role && isHTMLAnchorElement(element))) && key !== 'Enter')
	);
}

const nonTextInputTypes = new Set([
	'checkbox',
	'radio',
	'range',
	'color',
	'file',
	'image',
	'button',
	'submit',
	'reset',
]);

function shouldPreventDefaultKeyboard(target: Element, key: string) {
	if (target instanceof HTMLInputElement) {
		return !isValidInputKey(target, key);
	}

	if (target instanceof HTMLButtonElement) {
		return target.type !== 'submit' && target.type !== 'reset';
	}

	if (isHTMLAnchorElement(target)) {
		return false;
	}

	return true;
}

function isValidInputKey(target: HTMLInputElement, key: string) {
	// Only space should toggle checkboxes and radios, not enter.
	return target.type === 'checkbox' || target.type === 'radio'
		? key === ' '
		: nonTextInputTypes.has(target.type);
}
