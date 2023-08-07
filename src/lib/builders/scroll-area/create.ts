import {
	addMeltEventListener,
	builder,
	createElHelpers,
	derivedWithUnsubscribe,
	effect,
	executeCallbacks,
	isBrowser,
	noop,
	toWritableStores,
} from '$lib/internal/helpers';
import type { Defaults } from '$lib/internal/types';
import { get, writable } from 'svelte/store';
import type { CreateScrollAreaProps } from './types';
import { styleToString } from '$lib/internal/helpers/index.js';

type Direction = 'ltr' | 'rtl';
type Sizes = {
	content: number;
	viewport: number;
	scrollbar: {
		size: number;
		paddingStart: number;
		paddingEnd: number;
	};
};
type ScrollAreaParts =
	| 'viewport'
	| 'viewport-content'
	| 'scrollbar-hover'
	| 'scrollbar-scroll'
	| 'scrollbar-auto'
	| 'scrollbar-visible'
	| 'scrollbar-x'
	| 'scrollbar-y';

const { name, selector } = createElHelpers<ScrollAreaParts>('scroll-area');

const defaults = {
	type: 'hover',
	dir: 'ltr',
	scrollHideDelay: 600,
} satisfies Defaults<CreateScrollAreaProps>;

const machine = {
	hidden: {
		SCROLL: 'scrolling',
	},
	scrolling: {
		SCROLL_END: 'idle',
		POINTER_ENTER: 'interacting',
	},
	interacting: {
		SCROLL: 'interacting',
		POINTER_LEAVE: 'idle',
	},
	idle: {
		HIDE: 'hidden',
		SCROLL: 'scrolling',
		POINTER_ENTER: 'interacting',
	},
};

type State = 'hidden' | 'scrolling' | 'interacting' | 'idle';

export function createScrollArea(props: CreateScrollAreaProps) {
	const withDefaults = { ...defaults, ...props } satisfies CreateScrollAreaProps;

	const scrollAreaEl = writable<HTMLElement | null>(null);
	const viewportEl = writable<HTMLElement | null>(null);
	const contentEl = writable<HTMLElement | null>(null);
	const thumbEl = writable<HTMLElement | null>(null);
	const pointerOffset = writable(0);
	const scrollbarXEl = writable<HTMLElement | null>(null);
	const scrollbarYEl = writable<HTMLElement | null>(null);
	const cornerWidth = writable(0);
	const cornerHeight = writable(0);
	const scrollbarXEnabled = writable(false);
	const scrollbarYEnabled = writable(false);
	const options = toWritableStores(withDefaults);
	const { dir, type, scrollHideDelay } = options;
	const visible = writable(false);
	const state = writable<State>('hidden');
	const debounceTimer = writable(0);
	const sizes = writable<Sizes>({
		content: 0,
		viewport: 0,
		scrollbar: { size: 0, paddingStart: 0, paddingEnd: 0 },
	});
	const pointerPos = writable(0);
	const thumbRatio = getThumbRatio(get(sizes).viewport, get(sizes).content);

	const getScrollPosition = derivedWithUnsubscribe(
		[pointerOffset, sizes],
		([$pointerOffset, $sizes]) => {
			return (pointerPos: number, dir?: Direction) => {
				return getScrollPositionFromPointer(pointerPos, $pointerOffset, $sizes, dir);
			};
		}
	);

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
		action: () => {
			const styleEl = document.createElement('style');
			styleEl.innerHTML = `
            __html: [data-melt-scroll-area-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-melt-scroll-area-viewport]::-webkit-scrollbar{display:none}
            `;

			return {
				destroy: noop,
			};
		},
	});

	const viewportContent = builder(name('viewport-content'), {
		stores: [],
		returned: () => {
			return {
				style: styleToString({
					minWidth: '100%',
					display: 'table',
				}),
			};
		},
	});

	const scrollAreaScrollbarHover = builder(name('scrollbar-hover'), {
		stores: [visible],
		returned: ([$visible]) => {
			return {
				'data-state': $visible ? 'visible' : 'hidden',
			};
		},
	});

	effect([scrollAreaEl, scrollHideDelay], ([$scrollAreaEl, $scrollHideDelay]) => {
		let hideTimer = 0;
		if (!$scrollAreaEl) return;

		const handlePointerEnter = () => {
			window.clearTimeout(hideTimer);
			visible.set(true);
		};
		const handlePointerLeave = () => {
			hideTimer = window.setTimeout(() => visible.set(true), $scrollHideDelay);
		};
		$scrollAreaEl.addEventListener('pointerenter', handlePointerEnter);
		$scrollAreaEl.addEventListener('pointerleave', handlePointerLeave);
		return () => {
			window.clearTimeout(hideTimer);
			$scrollAreaEl.removeEventListener('pointerenter', handlePointerEnter);
			$scrollAreaEl.removeEventListener('pointerleave', handlePointerLeave);
		};
	});

	type ScrollbarProps = {
		orientation?: 'horizontal' | 'vertical';
	};

	const defaultScrollbarProps = {
		orientation: 'horizontal',
	} satisfies ScrollbarProps;

	const scrollbarScroll = builder(name('scrollbar-scroll'), {
		stores: [state],
		returned: ([$state]) => {
			return (props: ScrollbarProps = {}) => {
				const { orientation } = {
					...defaultScrollbarProps,
					...props,
				} satisfies ScrollbarProps;

				return {
					'data-orientation': orientation,
					'data-state': $state === 'hidden' ? 'hidden' : 'visible',
				};
			};
		},
		action: (node: HTMLElement) => {
			const orientation = node.dataset.orientation;
			if (!orientation) return;
			const isHorizontal = orientation === 'horizontal';
			const debounceScrollEnd = debounceCallback(() => state.set('idle'), 100);

			const unsubState = effect([state, scrollHideDelay], ([$state, $scrollHideDelay]) => {
				if ($state !== 'idle') return;

				const hideTimer = window.setTimeout(() => state.set('hidden'), $scrollHideDelay);
				return () => {
					window.clearTimeout(hideTimer);
				};
			});

			const unsubViewport = effect([viewportEl], ([$viewportEl]) => {
				const scrollDirection = isHorizontal ? 'scrollLeft' : 'scrollTop';
				if (!$viewportEl) return;
				let prevScrollPos = $viewportEl[scrollDirection];
				const handleScroll = () => {
					const scrollPos = $viewportEl[scrollDirection];
					const hasScrollInDirectionChange = prevScrollPos !== scrollPos;
					if (hasScrollInDirectionChange) {
						state.set('scrolling');
						debounceScrollEnd();
					}
					prevScrollPos = scrollPos;
				};
				$viewportEl.addEventListener('scroll', handleScroll);
				return () => $viewportEl.removeEventListener('scroll', handleScroll);
			});

			const unsubEvents = executeCallbacks(
				addMeltEventListener(node, 'pointerenter', () => {
					state.set('interacting');
				}),
				addMeltEventListener(node, 'pointerleave', () => {
					state.set('idle');
				})
			);

			return {
				destroy() {
					unsubState();
					unsubViewport();
					unsubEvents();
				},
			};
		},
	});

	const scrollbarAuto = builder(name('scrollbar-auto'), {
		stores: [visible],
		returned: ([$visible]) => {
			return (props: ScrollbarProps = {}) => {
				const { orientation } = { ...defaultScrollbarProps, ...props } satisfies ScrollbarProps;

				return {
					'data-orientation': orientation,
					'data-state': $visible ? 'visible' : 'hidden',
				};
			};
		},
		action: (node: HTMLElement) => {
			const orientation = node.dataset.orientation;
			if (!orientation) return;
			const isHorizontal = orientation === 'horizontal';
			const $viewportEl = get(viewportEl);
			const handleResize = debounceCallback(() => {
				if (!$viewportEl) return;
				const isOverflowX = $viewportEl.offsetWidth < $viewportEl.scrollWidth;
				const isOverflowY = $viewportEl.offsetHeight < $viewportEl.scrollHeight;
				visible.set(isHorizontal ? isOverflowX : isOverflowY);
			}, 10);
			useResizeObserver($viewportEl, handleResize);
			useResizeObserver(get(contentEl), handleResize);
		},
	});

	const scrollbarVisible = builder(name('scrollbar-visible'), {
		stores: [],
		returned: () => {
			return (props: ScrollbarProps = {}) => {
				const { orientation } = { ...defaultScrollbarProps, ...props } satisfies ScrollbarProps;
				return {
					'data-orientation': orientation,
				};
			};
		},
	});

	const scrollbarY = builder(name('scrollbar-y'), {});

	function debounceCallback(callback: () => void, delay: number) {
		window.clearTimeout(get(debounceTimer));
		return () => {
			window.clearTimeout(get(debounceTimer));
			debounceTimer.set(window.setTimeout(callback, delay));
		};
	}

	return {
		elements: {
			root,
			viewport,
			viewportContent,
		},
		options,
	};
}

function getThumbRatio(viewportSize: number, contentSize: number) {
	const ratio = viewportSize / contentSize;
	return isNaN(ratio) ? 0 : ratio;
}

function getThumbSize(sizes: Sizes) {
	const ratio = getThumbRatio(sizes.viewport, sizes.content);
	const scrollbarPadding = sizes.scrollbar.paddingStart + sizes.scrollbar.paddingEnd;
	const thumbSize = (sizes.scrollbar.size - scrollbarPadding) * ratio;
	// minimum of 18 matches macOS minimum
	return Math.max(thumbSize, 18);
}

function getScrollPositionFromPointer(
	pointerPos: number,
	pointerOffset: number,
	sizes: Sizes,
	dir: Direction = 'ltr'
) {
	const thumbSizePx = getThumbSize(sizes);
	const thumbCenter = thumbSizePx / 2;
	const offset = pointerOffset || thumbCenter;
	const thumbOffsetFromEnd = thumbSizePx - offset;
	const minPointerPos = sizes.scrollbar.paddingStart + offset;
	const maxPointerPos = sizes.scrollbar.size - sizes.scrollbar.paddingEnd - thumbOffsetFromEnd;
	const maxScrollPos = sizes.content - sizes.viewport;
	const scrollRange = dir === 'ltr' ? [0, maxScrollPos] : [maxScrollPos * -1, 0];
	const interpolate = linearScale([minPointerPos, maxPointerPos], scrollRange as [number, number]);
	return interpolate(pointerPos);
}

function useResizeObserver(node: HTMLElement | null, onResize: () => void) {
	const handleResize = onResize;
	let rAF = 0;

	const resizeObserver = new ResizeObserver(() => {
		cancelAnimationFrame(rAF);
		rAF = window.requestAnimationFrame(handleResize);
	});
	if (node) {
		resizeObserver.observe(node);
		return {
			destroy() {
				window.cancelAnimationFrame(rAF);
				resizeObserver.unobserve(node);
			},
		};
	}
	return {
		destroy: noop,
	};
}

function getThumbOffsetFromScroll(scrollPos: number, sizes: Sizes, dir: Direction = 'ltr') {
	const thumbSizePx = getThumbSize(sizes);
	const scrollbarPadding = sizes.scrollbar.paddingStart + sizes.scrollbar.paddingEnd;
	const scrollbar = sizes.scrollbar.size - scrollbarPadding;
	const maxScrollPos = sizes.content - sizes.viewport;
	const maxThumbPos = scrollbar - thumbSizePx;
	const scrollClampRange = dir === 'ltr' ? [0, maxScrollPos] : [maxScrollPos * -1, 0];
	const scrollWithoutMomentum = clamp(scrollPos, scrollClampRange as [number, number]);
	const interpolate = linearScale([0, maxScrollPos], [0, maxThumbPos]);
	return interpolate(scrollWithoutMomentum);
}

function clamp(value: number, [min, max]: [number, number]): number {
	return Math.min(max, Math.max(min, value));
}

// https://github.com/tmcw-up-for-adoption/simple-linear-scale/blob/master/index.js
function linearScale(input: readonly [number, number], output: readonly [number, number]) {
	return (value: number) => {
		if (input[0] === input[1] || output[0] === output[1]) return output[0];
		const ratio = (output[1] - output[0]) / (input[1] - input[0]);
		return output[0] + ratio * (value - input[0]);
	};
}

function isScrollingWithinScrollbarBounds(scrollPos: number, maxScrollPos: number) {
	return scrollPos > 0 && scrollPos < maxScrollPos;
}

// Custom scroll handler to avoid scroll-linked effects
// https://developer.mozilla.org/en-US/docs/Mozilla/Performance/Scroll-linked_effects
const addUnlinkedScrollListener = (node: HTMLElement, handler = () => {}) => {
	let prevPosition = { left: node.scrollLeft, top: node.scrollTop };
	let rAF = 0;
	(function loop() {
		const position = { left: node.scrollLeft, top: node.scrollTop };
		const isHorizontalScroll = prevPosition.left !== position.left;
		const isVerticalScroll = prevPosition.top !== position.top;
		if (isHorizontalScroll || isVerticalScroll) handler();
		prevPosition = position;
		rAF = window.requestAnimationFrame(loop);
	})();
	return () => window.cancelAnimationFrame(rAF);
};
