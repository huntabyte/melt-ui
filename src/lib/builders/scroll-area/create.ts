import { builder, createElHelpers, toWritableStores } from '$lib/internal/helpers';
import type { Defaults } from '$lib/internal/types';
import { writable } from 'svelte/store';
import type { CreateScrollAreaProps } from './types';
import { styleToString } from '$lib/internal/helpers/index.js';

const defaults = {
	type: 'hover',
	dir: 'ltr',
	scrollHideDelay: 600,
} satisfies Defaults<CreateScrollAreaProps>;

type ScrollAreaParts = 'viewport';
const { name, selector } = createElHelpers<ScrollAreaParts>('scroll-area');

export function createScrollArea(props: CreateScrollAreaProps) {
	const withDefaults = { ...defaults, ...props } satisfies CreateScrollAreaProps;

	const scrollAreaEl = writable<HTMLElement | null>(null);
	const viewportEl = writable<HTMLElement | null>(null);
	const contentEl = writable<HTMLElement | null>(null);
	const scrollbarXEl = writable<HTMLElement | null>(null);
	const scrollbarYEl = writable<HTMLElement | null>(null);
	const cornerWidth = writable(0);
	const cornerHeight = writable(0);
	const scrollbarXEnabled = writable(false);
	const scrollbarYEnabled = writable(false);
	const options = toWritableStores(withDefaults);
	const { dir, type, scrollHideDelay } = options;

	const root = builder(name(), {
		stores: [cornerWidth, cornerHeight, dir],
		returned: ([$cornerWidth, $cornerHeight, $dir]) => {
			return {
				dir: $dir,
				style: styleToString({
					position: 'relative',
					['--melt-scroll-area-corner-width']: $cornerWidth + 'px',
					['--melt-scroll-area-corner-height']: $cornerHeight + 'px',
				}),
			};
		},
	});

	const viewport = builder(name('viewport'), {
		stores: [scrollbarXEnabled, scrollbarYEnabled],
		returned: ([$scrollbarXEnabled, $scrollbarYEnabled]) => {
			return {
				style: styleToString({
					overflowX: $scrollbarXEnabled ? 'scroll' : 'hidden',
					overflowY: $scrollbarYEnabled ? 'scroll' : 'hidden',
				}),
			};
		},
		action: (node: HTMLElement) => {
			const styleEl = document.createElement('style');
			styleEl.innerHTML = `
            __html: [data-melt-scroll-area-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-melt-scroll-area-viewport]::-webkit-scrollbar{display:none}
            `;
		},
	});

	return {
		elements: {
			root,
		},
		options,
	};
}
