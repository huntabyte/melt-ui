import type { FloatingConfig } from '$lib/internal/actions';
import { usePopper } from '$lib/internal/actions/popper';
import {
	effect,
	elementDerived,
	elementMultiDerived,
	isBrowser,
	kbd,
	styleToString,
	uuid,
} from '$lib/internal/helpers';
import type { PointerEventHandler } from 'svelte/elements';
import { derived, get, writable } from 'svelte/store';

type Direction = 'ltr' | 'rtl';

const SELECTION_KEYS = [kbd.ENTER, kbd.SPACE];
const FIRST_KEYS = [kbd.ARROW_DOWN, kbd.PAGE_UP, kbd.HOME];
const LAST_KEYS = [kbd.ARROW_UP, kbd.PAGE_DOWN, kbd.END];
const FIRST_LAST_KEYS = [...FIRST_KEYS, ...LAST_KEYS];
const SUB_OPEN_KEYS: Record<Direction, string[]> = {
	ltr: [...SELECTION_KEYS, kbd.ARROW_RIGHT],
	rtl: [...SELECTION_KEYS, kbd.ARROW_LEFT],
};
const SUB_CLOSE_KEYS: Record<Direction, string[]> = {
	ltr: [kbd.ARROW_LEFT],
	rtl: [kbd.ARROW_RIGHT],
};

/**
 * Features:
 * - [X] Click outside
 * - [X] Keyboard navigation
 * - [X] Focus management
 * - [ ] Detect overflow
 * - [ ] Same width as trigger
 * - [ ] A11y
 * - [X] Floating UI
 **/

type CreateDropdownMenuArgs = {
	positioning?: FloatingConfig;
	arrowSize?: number;
	open?: boolean;
};

const defaults = {
	positioning: {
		placement: 'bottom',
	},
	arrowSize: 8,
	open: false,
} satisfies CreateDropdownMenuArgs;

export function createDropdownMenu(args?: CreateDropdownMenuArgs) {
	const withDefaults = { ...defaults, ...args } as CreateDropdownMenuArgs;
	const options = writable({ ...withDefaults });

	const open = writable(false);
	const selected = writable<string | null>(null);
	const selectedText = writable<string | null>(null);
	const activeTrigger = writable<HTMLElement | null>(null);
	const openSubMenus = writable<string[]>([]);
	const pointerGraceTimer = writable(0);
	const pointerGraceIntent = writable<GraceIntent | null>(null);
	const pointerDirection = writable<Side>('left');
	const pointerDownEl = writable<HTMLElement | null>(null);
	const lastPointerX = writable(0);
	const focusedEl = writable<HTMLElement | null>(null);
	const currentMenu = writable<HTMLElement | null>(null);
	const currentItemId = writable<string | null>(null);

	const menuContext = derived(
		[currentMenu, pointerGraceTimer],
		([$currentMenu, $pointerGraceTimer]) => {
			return {
				onItemEnter: (e: PointerEvent) => {
					if (isPointerMovingToSubmenu(e)) e.preventDefault();
				},
				onItemLeave: (e: PointerEvent) => {
					if (isPointerMovingToSubmenu(e)) return;
					$currentMenu?.focus();
					currentItemId.set(null);
				},
				onTriggerLeave: (e: PointerEvent) => {
					if (isPointerMovingToSubmenu(e)) e.preventDefault();
				},
				pointerGraceTimer: $pointerGraceTimer,
				onPointerGraceIntentChange: (intent: GraceIntent | null) => {
					pointerGraceIntent.set(intent);
				},
			};
		}
	);

	const ids = {
		menu: uuid(),
		trigger: uuid(),
	};

	function isPointerMovingToSubmenu(event: PointerEvent) {
		const isMovingTowards = get(pointerDirection) === get(pointerGraceIntent)?.side;
		return isMovingTowards && isPointerInGraceArea(event, get(pointerGraceIntent)?.area);
	}

	const menu = elementDerived(
		[open, activeTrigger, options],
		([$open, $activeTrigger, $options], { addAction, attach, getElement }) => {
			if ($open && $activeTrigger) {
				addAction(usePopper, {
					anchorElement: $activeTrigger,
					open,
					options: {
						floating: $options.positioning,
					},
				});

				// currentMenu.set(menuEl);

				attach('pointerenter', (e) => {
					if (isPointerMovingToSubmenu(e)) {
						e.preventDefault();
					}
				});

				attach('pointerleave', (e) => {
					if (isPointerMovingToSubmenu(e)) {
						e.preventDefault();
					}
				});

				attach('keydown', (e) => {
					const target = e.target as HTMLElement;
					const isKeyDownInside = target.closest('[data-melt-menu-content]') === e.currentTarget;
					// const isModifierKey = e.ctrlKey || e.altKey || e.metaKey;
					// const isCharacterKey = e.key.length === 1;

					if (isKeyDownInside) {
						// menus should not be navigated using tab key so we prevent it
						if (e.key === kbd.TAB) {
							e.preventDefault();
						}
					}

					const _currentMenu = get(currentMenu);
					if (!_currentMenu || _currentMenu !== e.target) return;
					if (!FIRST_LAST_KEYS.includes(e.key)) return;
					e.preventDefault();
					const items = Array.from(
						_currentMenu.querySelectorAll('[role="menuitem"]')
					) as HTMLElement[];
					console.log(items);
				});

				attach('pointermove', (e) => {
					whenMouse((event) => {
						const target = e.target as HTMLElement;
						const _lastPointerX = get(lastPointerX);
						const pointerXHasChanged = _lastPointerX !== event.clientX;

						// We don't use `event.movementX` for this check because Safari will
						// always return `0` on a pointer event.
						if ((e.currentTarget as HTMLElement).contains(target) && pointerXHasChanged) {
							const newDir = e.clientX > _lastPointerX ? 'right' : 'left';
							pointerDirection.set(newDir);
							lastPointerX.set(e.clientX);
						}
					});
				});
			}

			return {
				hidden: $open ? undefined : true,
				style: styleToString({
					display: $open ? undefined : 'none',
				}),
				'aria-labelledby': ids.trigger,
				'data-melt-menu-content': '',
				role: 'menu',
			};
		}
	);

	const subMenu = elementMultiDerived([openSubMenus], ([$openSubMenus], { addAction }) => {
		return ({ id }: { id: string }) => {
			const isOpen = $openSubMenus.includes(id);
			let triggerId = '';

			if (isOpen) {
				const anchorElement = getElementByAriaControls(id);
				if (!anchorElement) return;
				triggerId = anchorElement.id;

				addAction(usePopper, {
					anchorElement: anchorElement,
					open: writable(true),
					options: {
						floating: {
							placement: 'right-start',
						},
					},
				});
			}
			return {
				id,
				hidden: isOpen ? undefined : true,
				style: styleToString({
					display: isOpen ? undefined : 'none',
				}),
				'aria-labelledby': triggerId,
				role: 'menu',
			};
		};
	});

	const trigger = elementDerived([open], ([$open], { attach }) => {
		attach('click', (e) => {
			e.stopPropagation();
			const triggerEl = e.currentTarget as HTMLElement;
			open.update((prev) => {
				const isOpen = !prev;
				if (isOpen) {
					activeTrigger.set(triggerEl);
				} else {
					activeTrigger.set(null);
					openSubMenus.set([]);
				}

				return isOpen;
			});
		});

		attach('keydown', (e) => {
			e.stopPropagation();
			if (e.key === kbd.ENTER || e.key === kbd.SPACE || e.key === kbd.ARROW_DOWN) {
				const triggerEl = e.currentTarget as HTMLElement;
				open.update((prev) => {
					const isOpen = !prev;
					if (isOpen) {
						activeTrigger.set(triggerEl);
					} else {
						activeTrigger.set(null);
						openSubMenus.set([]);
					}
					return isOpen;
				});
			}
		});

		return {
			role: 'combobox',
			'aria-controls': ids.menu,
			'aria-expanded': $open,
			'data-state': $open ? 'open' : 'closed',
			id: ids.trigger,
		};
	});

	const arrow = derived(options, ($options) => ({
		'data-arrow': true,
		style: styleToString({
			position: 'fixed',
			width: `var(--arrow-size, ${$options.arrowSize}px)`,
			height: `var(--arrow-size, ${$options.arrowSize}px)`,
		}),
	}));

	type SubTriggerArgs = {
		triggerFor: string;
		disabled: boolean;
		onClick: (e: MouseEvent) => void;
		onPointerMove: (e: MouseEvent) => void;
	};

	const subTrigger = elementMultiDerived([openSubMenus], ([$openSubMenus], { attach }) => {
		return (args: SubTriggerArgs) => {
			const isOpen = $openSubMenus.includes(args.triggerFor);

			// This is redundant for mouse users but we cannot determine pointer type from
			// click event and we cannot use pointerup event (see git history for reasons why)
			attach('click', (e) => {
				args.onClick?.(e);
				if (args.disabled || e.defaultPrevented) return;

				/**
				 * We manually focus because iOS Safari doesn't always focus on click (e.g. buttons)
				 * and we rely heavily on `onFocusOutside` for submenus to close when switching
				 * between separate submenus.
				 */
				(e.currentTarget as HTMLElement).focus();
				if (!isOpen) {
					openSubMenus.update((prev) => {
						return [...prev, args.triggerFor];
					});
				}
			});

			attach('pointermove', (e) => {
				args.onPointerMove?.(e);
			});

			attach('keydown', (e) => {
				if (e.key === kbd.ENTER || e.key === kbd.SPACE) {
					e.stopPropagation();
					e.stopImmediatePropagation();
					openSubMenus.update((prev) => {
						return [...prev, args.triggerFor];
					});
				}
			});

			attach('mouseover', (e) => {
				const el = e.currentTarget as HTMLElement;
				el.focus();
				openSubMenus.update((prev) => {
					if (prev.includes(args.triggerFor)) {
						// remove menuId from array
						return prev;
					}
					return [...prev, args.triggerFor];
				});
			});

			attach('mouseout', (e) => {
				const el = e.currentTarget as HTMLElement;
				el.blur();
				// openSubMenus.update((prev) => {
				// 	if (prev.includes(menuId)) {
				// 		// remove menuId from array
				// 		const newArr = prev.filter((id) => id !== menuId);
				// 		return newArr;
				// 	}
				// 	return [...prev, menuId];
				// });
			});

			return {
				role: 'menuitem',
				tabindex: 0,
				'aria-haspopup': 'menu',
				'aria-controls': args.triggerFor,
				'data-state': isOpen ? 'open' : 'closed',
			};
		};
	});

	type ItemArgs = {
		value: string;
		disabled: boolean;
	};

	const item = elementMultiDerived([selected], ([$selected], { attach, getElement }) => {
		return ({ value, disabled }: ItemArgs) => {
			getElement().then((el) => {
				if (el) {
					const menuMeltId = el
						.closest('[role="menu"][data-melt-id]')
						?.getAttribute('data-melt-id');
					el?.setAttribute('data-melt-menu', menuMeltId || '');
				}
			});

			attach('click', (e) => {
				const target = e.currentTarget as HTMLElement;
				selected.set(value);
				selectedText.set(target.innerText);
				open.set(false);
			});

			attach('pointerdown', (e) => {
				pointerDownEl.set(e.currentTarget as HTMLElement);
			});

			attach('pointerup', (e) => {
				// Pointer down can move to a different menu item which should activate it on pointer up.
				// We dispatch a click for selection to allow composition with click based triggers and to
				// prevent Firefox from getting stuck in text selection mode when the menu closes.
				const _pointerDownEl = get(pointerDownEl);
				if (_pointerDownEl !== e.currentTarget) {
					(e.currentTarget as HTMLElement).click();
				}
			});

			attach('keydown', (e) => {
				if (SELECTION_KEYS.includes(e.key)) {
					(e.currentTarget as HTMLElement).click();
					/**
					 * Prevent default browser behaviour for selection keys as they should trigger
					 * a selection only:
					 * - prevents space from scrolling the page.
					 * - if keydown causes focus to move, prevents keydown from firing on the new target.
					 */
					e.preventDefault();
				}
			});

			attach('pointermove', (e) => {
				if (e.pointerType !== 'mouse') return;
				const menuCtx = get(menuContext);
				if (!menuCtx) return;

				if (disabled) {
					menuCtx.onItemLeave(e);
				} else {
					menuCtx.onItemEnter(e);
					if (!e.defaultPrevented) {
						(e.currentTarget as HTMLElement).focus();
					}
				}
			});

			attach('pointerleave', (e) => {
				if (e.pointerType !== 'mouse') return;
				const menuCtx = get(menuContext);
				if (!menuCtx) return;

				menuCtx.onItemLeave(e);
			});

			return {
				role: 'menuitem',
				'aria-selected': $selected === value,
				'data-selected': $selected === value ? '' : undefined,
				tabindex: 0,
			};
		};
	});

	// let typed: string[] = [];
	// const resetTyped = debounce(() => {
	// 	typed = [];
	// });

	effect([open], ([$open]) => {
		if (!isBrowser) return;
		if (!$open) {
			openSubMenus.set([]);
		}
	});

	const isSelected = derived(
		[selected],
		([$selected]) =>
			(value: string) =>
				$selected === value
	);

	return {
		trigger,
		menu,
		open,
		arrow,
		item,
		selected,
		selectedText,
		isSelected,
		subTrigger,
		subMenu,
		options,
	};
}

function getElementByAriaControls(ariaControlsValue: string): HTMLElement | null {
	return document.querySelector(`[aria-controls="${ariaControlsValue}"]`);
}

function focusFirst(candidates: HTMLElement[]) {
	const PREVIOUSLY_FOCUSED_ELEMENT = document.activeElement;
	for (const candidate of candidates) {
		// if focus is already where we want to go, we don't want to keep going through the candidates
		if (candidate === PREVIOUSLY_FOCUSED_ELEMENT) return;
		candidate.focus();
		if (document.activeElement !== PREVIOUSLY_FOCUSED_ELEMENT) return;
	}
}

function wrapArray<T>(array: T[], startIndex: number) {
	return array.map((_, index) => array[(startIndex + index) % array.length]);
}

function getNextMatch(values: string[], search: string, currentMatch?: string) {
	const isRepeated = search.length > 1 && Array.from(search).every((char) => char === search[0]);
	const normalizedSearch = isRepeated ? search[0] : search;
	const currentMatchIndex = currentMatch ? values.indexOf(currentMatch) : -1;
	let wrappedValues = wrapArray(values, Math.max(currentMatchIndex, 0));
	const excludeCurrentMatch = normalizedSearch.length === 1;
	if (excludeCurrentMatch) wrappedValues = wrappedValues.filter((v) => v !== currentMatch);
	const nextMatch = wrappedValues.find((value) =>
		value.toLowerCase().startsWith(normalizedSearch.toLowerCase())
	);
	return nextMatch !== currentMatch ? nextMatch : undefined;
}

type Point = { x: number; y: number };
type Polygon = Point[];
type Side = 'left' | 'right';
type GraceIntent = { area: Polygon; side: Side };

// Determine if a point is inside of a polygon.
// Based on https://github.com/substack/point-in-polygon
function isPointInPolygon(point: Point, polygon: Polygon) {
	const { x, y } = point;
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i].x;
		const yi = polygon[i].y;
		const xj = polygon[j].x;
		const yj = polygon[j].y;

		// prettier-ignore
		const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
		if (intersect) inside = !inside;
	}

	return inside;
}

function isPointerInGraceArea(event: PointerEvent, area?: Polygon) {
	if (!area) return false;
	const cursorPos = { x: event.clientX, y: event.clientY };
	return isPointInPolygon(cursorPos, area);
}

function whenMouse<E extends EventTarget>(handler: PointerEventHandler<E>): PointerEventHandler<E> {
	return (event) => (event.pointerType === 'mouse' ? handler(event) : undefined);
}
