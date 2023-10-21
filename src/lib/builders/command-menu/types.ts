import type { ChangeFn } from '$lib/internal/helpers';
import type { Writable } from 'svelte/store';

export type CreateCommandMenuProps = {
	/**
	 * An accessible label for the command menu. Not visibly displayed.
	 */
	label?: string;

	/**
	 * Optionally set to `false` to disable automatic filtering & sorting.
	 * If `false`, you must manually handle filtering & sorting.
	 */
	shouldFilter?: boolean;

	/**
	 * Custom filter function for whether each command menu item should match
	 * the search query. It should return a number between 0 and 1, where 1 is the
	 * best match, and 0 is the worst match and hidden from the list.
	 *
	 * By default, used a fuzzy search algorithm via the `command-score` library.
	 */
	filter?: (value: string, search: string) => number;

	/**
	 * Optional default item value to select when initially rendered.
	 */
	defaultValue?: string;

	/**
	 * Optional controlled value store for the selected item.
	 */
	value?: Writable<string | undefined>;

	/**
	 * Change function called when the value changes.
	 */
	onValueChange?: ChangeFn<string | undefined>;

	/**
	 * Control whether the items should loop around when navigating
	 * with the arrow keys.
	 */
	loop?: boolean;
};

export type CommandItemProps = {
	/**
	 * Whether the item is disabled.
	 */
	disabled?: boolean;

	/**
	 * A unique value for the item.
	 *
	 * If a value is not provided, the item's `textContent` will be
	 * used. If `textContent` changes between renders, you should
	 * provide a stable, unique value for this prop.
	 */
	value?: string;
};
