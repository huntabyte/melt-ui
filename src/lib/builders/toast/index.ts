import { addEventListener, styleToString } from '$lib/internal/helpers';
import type { Defaults } from '$lib/internal/types';
import { derived, get, writable, type Writable } from 'svelte/store';

type SwipeDirection = 'up' | 'down' | 'left' | 'right';

// export type CreateToastArgs = {
// 	label: string;
// 	duration: number;
// 	swipeDirection: SwipeDirection;
// 	swipeThreshold: number;
// 	toastCount: number;
// 	onToastAdd(): void;
// 	onToastRemove(): void;
// 	isFocusedToastEscapeKeyDown: Writable<boolean>;
// 	isClosePaused: Writable<boolean>;
// };

export type CreateToastArgs = {
	/**
	 * Localized label for the toast for accessibility purposes.
	 * @defaultValue 'Notification'
	 */
	label?: string;
	/**
	 * Time in miliseconds to show the toast.
	 * @defaultValue 5000
	 */
	duration?: number;
	/**
	 * Direction of the swipe to dismiss the toast.
	 * @defaultValue 'right'
	 */
	swipeDirection?: SwipeDirection;
	/**
	 * Threshold in pixels to dismiss the toast.
	 * @defaultValue 50
	 */
	swipeThreshold?: number;
};

const defaults = {
	label: 'Notification',
	duration: 5000,
	swipeDirection: 'right',
	swipeThreshold: 50,
} satisfies Defaults<CreateToastArgs>;

export function createToast(args: CreateToastArgs = {}) {
	const argsWithDefaults = { ...defaults, ...args };
	const options = writable(argsWithDefaults);
}
