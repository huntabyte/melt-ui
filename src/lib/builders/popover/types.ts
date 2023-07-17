import type { FloatingConfig } from '$lib/internal/actions';
import type { ChangeFn } from '$lib/internal/helpers';
import type { Writable } from 'svelte/store';
import type { createPopover } from './create';

export type CreatePopoverProps = {
	/**
	 * Configure the floating UI positioning behavior of the popover.
	 */
	positioning?: FloatingConfig;

	/**
	 * The size of the optional arrow element in pixels
	 */
	arrowSize?: number;

	/**
	 * The initial state of open. Should only be used if the popover is uncontrolled
	 */
	defaultOpen?: boolean;

	/**
	 * A store that controls the open state. Use when you want to directly control
	 * the popover.
	 */
	open?: Writable<boolean>;

	/**
	 * Optional function that runs whenever open should change.
	 * When present, will control state changes instead of the default behaviour
	 */
	onOpenChange?: ChangeFn<boolean>;

	/**
	 * Whether or not to disable the focus trap
	 *
	 * @default false
	 */
	disableFocusTrap?: boolean;
};

export type CreatePopoverReturn = ReturnType<typeof createPopover>;
