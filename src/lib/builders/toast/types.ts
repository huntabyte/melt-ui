import type { BuilderReturn } from '$lib/internal/types.js';
import type { createToaster } from './create.js';
export type { ToastComponentEvents } from './events.js';
export type EmptyType = Record<never, never>;

/**
 * @category Toast
 * @category Props
 * @interface
 */
export type CreateToasterProps = {
	// Time in milliseconds before the toast is automatically closed.
	// If set to 0, the toast will not be automatically closed.
	closeDelay?: number;
	type?: 'foreground' | 'background';
};

/**
 * @category Toast
 */
export type AddToastProps<T = object> = CreateToasterProps & {
	data: T;
};

/**
 * @category Toast
 */
export type Toast<T = object> = {
	id: string;
	ids: {
		content: string;
		title: string;
		description: string;
	};
	closeDelay: number;
	type: 'foreground' | 'background';
	data: T;
	timeout: number | null;
	createdAt: number;
	pausedAt?: number;
	pauseDuration: number;
	getPercentage: () => number;
};

export type Toasts<T = object> = BuilderReturn<typeof createToaster<T>>;
export type ToastsElements<T = object> = BuilderReturn<typeof createToaster<T>>['elements'];
export type ToastsOptions<T = object> = BuilderReturn<typeof createToaster<T>>['options'];
export type ToastsStates<T = object> = BuilderReturn<typeof createToaster<T>>['states'];
export type ToastsHelpers<T = object> = BuilderReturn<typeof createToaster<T>>['helpers'];
