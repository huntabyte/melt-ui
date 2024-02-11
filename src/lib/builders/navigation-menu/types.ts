import type { Orientation, TextDirection } from '$lib/internal/types.js';
import type { Writable } from 'svelte/store';

export type CreateNavigationMenuProps = {
	/**
	 * The uncontrolled default value of the active navigation
	 * menu item.
	 */
	defaultValue?: string;

	/**
	 * The controlled value store for the active navigation
	 * menu item.
	 * If provided, this will override the value passed to `defaultValue`.
	 *
	 * @see https://melt-ui.com/docs/controlled#bring-your-own-store
	 */
	value?: Writable<string | undefined>;

	/**
	 * The reading direction of the navigation menu.
	 *
	 * @default 'ltr'
	 */
	dir?: TextDirection;

	/**
	 * The orientation of the menu
	 */
	orientation?: Orientation;

	/**
	 * The duration from when the pointer enters the trigger until the menu is opened.
	 *
	 * @default 300
	 */
	delayDuration?: number;

	/**
	 * How much time a user has to enter another trigger without incurring a delay again
	 *
	 * @default 300
	 */
	skipDelayDuration?: number;
};
