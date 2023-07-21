import {
	addEventListener,
	builder,
	createElHelpers,
	effect,
	generateId,
	getElementByMeltId,
	isBrowser,
	isHTMLElement,
	kbd,
	omit,
	overridable,
	styleToString,
	toWritableStores,
} from '$lib/internal/helpers';
import { derived, get, writable } from 'svelte/store';
import type { CreateSliderProps } from './types';

const defaults = {
	defaultValue: [],
	min: 0,
	max: 100,
	step: 1,
	orientation: 'horizontal',
	disabled: false,
} satisfies CreateSliderProps;

const { name } = createElHelpers('slider');

export const createSlider = (props?: CreateSliderProps) => {
	const withDefaults = { ...defaults, ...props } satisfies CreateSliderProps;

	const options = toWritableStores(omit(withDefaults, 'value'));
	const { min, max, step, orientation, disabled } = options;

	const valueWritable = withDefaults.value ?? writable(withDefaults.defaultValue);
	const value = overridable(valueWritable, withDefaults?.onValueChange);

	const isActive = writable(false);
	const currentThumbIndex = writable<number>(0);
	const activeThumb = writable<{ thumb: HTMLElement; index: number } | null>(null);

	const ids = {
		root: generateId(),
	};

	const root = builder(name(), {
		stores: [disabled, orientation],
		returned: ([$disabled, $orientation]) => {
			return {
				disabled: $disabled,
				'data-orientation': $orientation,
				style: $disabled ? undefined : 'touch-action: none;',
				'data-melt-id': ids.root,
			};
		},
	});

	const position = derived([min, max], ([$min, $max]) => {
		return (val: number) => {
			const pos = ((val - $min) / ($max - $min)) * 100;

			return Math.abs(pos);
		};
	});

	const range = builder(name('range'), {
		stores: [value, orientation, position],
		returned: ([$value, $orientation, $position]) => {
			const minimum = $value.length > 1 ? $position(Math.min(...$value) ?? 0) : 0;
			const maximum = 100 - $position(Math.max(...$value) ?? 0);

			const orientationStyles =
				$orientation === 'horizontal'
					? { left: `${minimum}%`, right: `${maximum}%` }
					: { top: `${maximum}%`, bottom: `${minimum}%` };

			return {
				style: styleToString({
					position: 'absolute',
					...orientationStyles,
				}),
			};
		},
	});

	const updatePosition = (val: number, index: number) => {
		value.update((prev) => {
			if (!prev) return [val];

			const isFirst = index === 0;
			const isLast = index === prev.length - 1;

			if (!isLast && val > prev[index + 1]) {
				prev[index] = prev[index + 1];
			} else if (!isFirst && val < prev[index - 1]) {
				prev[index] = prev[index - 1];
			} else {
				prev[index] = val;
			}

			return prev.map(Math.abs);
		});
	};

	const getAllThumbs = () => {
		const root = getElementByMeltId(ids.root);
		if (!root) return null;

		const thumbs = Array.from(root.querySelectorAll('[data-melt-part="thumb"]')).filter(
			Boolean
		) as Array<HTMLElement>;
		return thumbs;
	};

	const thumb = builder(name('thumb'), {
		stores: [value, position, min, max, disabled, orientation],
		returned: ([$value, $position, $min, $max, $disabled, $orientation]) => {
			let index = -1;

			return () => {
				index++;

				const currentThumb = get(currentThumbIndex);

				if (currentThumb < $value.length) {
					currentThumbIndex.update((prev) => prev + 1);
				}

				const thumbPosition = `${$position($value[index])}%`;
				return {
					role: 'slider',
					'aria-label': 'Volume',
					'aria-valuemin': $min,
					'aria-valuemax': $max,
					'aria-valuenow': $value[index],
					'data-melt-part': 'thumb',
					style: styleToString({
						position: 'absolute',
						...($orientation === 'horizontal'
							? { left: thumbPosition, translate: '-50% 0' }
							: { bottom: thumbPosition, translate: '0 50%' }),
					}),
					tabindex: $disabled ? -1 : 0,
				} as const;
			};
		},
		action: (node: HTMLElement) => {
			const unsub = addEventListener(node, 'keydown', (event) => {
				const $min = get(min);
				const $max = get(max);
				if (get(disabled)) return;

				const target = event.currentTarget;
				if (!isHTMLElement(target)) return;

				const thumbs = getAllThumbs();
				if (!thumbs?.length) return;

				const index = thumbs.indexOf(target);
				currentThumbIndex.set(index);

				if (
					![
						kbd.ARROW_LEFT,
						kbd.ARROW_RIGHT,
						kbd.ARROW_UP,
						kbd.ARROW_DOWN,
						kbd.HOME,
						kbd.END,
					].includes(event.key)
				) {
					return;
				}

				event.preventDefault();

				const $step = get(step);
				const $value = get(value);
				const $orientation = get(orientation);

				switch (event.key) {
					case kbd.HOME: {
						updatePosition($min, index);
						break;
					}
					case kbd.END: {
						updatePosition($max, index);
						break;
					}
					case kbd.ARROW_LEFT: {
						if ($orientation !== 'horizontal') break;

						if (event.metaKey) {
							updatePosition($min, index);
						} else if ($value[index] > $min) {
							const newValue = $value[index] - $step;
							updatePosition(newValue, index);
						}
						break;
					}
					case kbd.ARROW_RIGHT: {
						if ($orientation !== 'horizontal') break;

						if (event.metaKey) {
							updatePosition($max, index);
						} else if ($value[index] < $max) {
							const newValue = $value[index] + $step;
							updatePosition(newValue, index);
						}
						break;
					}
					case kbd.ARROW_UP: {
						if (event.metaKey) {
							updatePosition($max, index);
						} else if ($value[index] > $min && $orientation === 'vertical') {
							const newValue = $value[index] - $step;
							updatePosition(newValue, index);
						} else if ($value[index] < $max) {
							const newValue = $value[index] + $step;
							updatePosition(newValue, index);
						}
						break;
					}
					case kbd.ARROW_DOWN: {
						if (event.metaKey) {
							updatePosition($min, index);
						} else if ($value[index] < $max && $orientation === 'vertical') {
							const newValue = $value[index] + $step;
							updatePosition(newValue, index);
						} else if ($value[index] > $min) {
							const newValue = $value[index] - $step;
							updatePosition(newValue, index);
						}
						break;
					}
				}
			});

			return {
				destroy: unsub,
			};
		},
	});

	effect(
		[root, min, max, disabled, orientation, step],
		([$root, $min, $max, $disabled, $orientation, $step]) => {
			if (!isBrowser || $disabled) return;

			const applyPosition = (
				clientXY: number,
				activeThumbIdx: number,
				leftOrBottom: number,
				rightOrTop: number
			) => {
				const percent = (clientXY - leftOrBottom) / (rightOrTop - leftOrBottom);
				const val = Math.round(percent * ($max - $min) + $min);

				if (val < $min || val > $max) return;
				const step = $step;
				const newValue = Math.round(val / step) * step;

				updatePosition(newValue, activeThumbIdx);
			};

			const getClosestThumb = (e: PointerEvent) => {
				const thumbs = getAllThumbs();
				if (!thumbs) return;
				thumbs.forEach((thumb) => thumb?.blur());

				const distances = thumbs.map((thumb) => {
					if ($orientation === 'horizontal') {
						const { left, right } = thumb.getBoundingClientRect();
						return Math.abs(e.clientX - (left + right) / 2);
					} else {
						const { top, bottom } = thumb.getBoundingClientRect();
						return Math.abs(e.clientY - (top + bottom) / 2);
					}
				});

				const thumb = thumbs[distances.indexOf(Math.min(...distances))];
				const index = thumbs.indexOf(thumb);

				return { thumb, index };
			};

			const pointerDown = (e: PointerEvent) => {
				if (e.button !== 0) return;

				const sliderEl = getElementByMeltId($root['data-melt-id']);
				const closestThumb = getClosestThumb(e);
				if (!closestThumb || !sliderEl) return;

				const target = e.target;
				if (!isHTMLElement(target)) return;

				if (!sliderEl.contains(target)) return;
				e.preventDefault();

				activeThumb.set(closestThumb);
				closestThumb.thumb.focus();
				isActive.set(true);

				if ($orientation === 'horizontal') {
					const { left, right } = sliderEl.getBoundingClientRect();
					applyPosition(e.clientX, closestThumb.index, left, right);
				} else {
					const { top, bottom } = sliderEl.getBoundingClientRect();
					applyPosition(e.clientY, closestThumb.index, bottom, top);
				}
			};

			const pointerUp = () => {
				isActive.set(false);
			};

			const pointerMove = (e: PointerEvent) => {
				if (!get(isActive)) return;

				const sliderEl = getElementByMeltId($root['data-melt-id']);
				const closestThumb = get(activeThumb);
				if (!sliderEl || !closestThumb) return;

				closestThumb.thumb.focus();

				if ($orientation === 'horizontal') {
					const { left, right } = sliderEl.getBoundingClientRect();
					applyPosition(e.clientX, closestThumb.index, left, right);
				} else {
					const { top, bottom } = sliderEl.getBoundingClientRect();
					applyPosition(e.clientY, closestThumb.index, top, bottom);
				}
			};

			document.addEventListener('pointerdown', pointerDown);
			document.addEventListener('pointerup', pointerUp);
			document.addEventListener('pointerleave', pointerUp);
			document.addEventListener('pointermove', pointerMove);

			return () => {
				document.removeEventListener('pointerdown', pointerDown);
				document.removeEventListener('pointerup', pointerUp);
				document.removeEventListener('pointerleave', pointerUp);
				document.removeEventListener('pointermove', pointerMove);
			};
		}
	);

	return {
		elements: {
			root,
			thumb,
			range,
		},
		states: {
			value,
		},
		options,
	};
};
