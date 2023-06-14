import type { FloatingConfig } from '$lib/internal/actions';
import { usePopper } from '$lib/internal/actions/popper';
import {
	debounce,
	effect,
	elementDerived,
	elementMulti,
	elementMultiDerived,
	getElementByMeltId,
	isBrowser,
	kbd,
	styleToString,
	uuid,
} from '$lib/internal/helpers';
import { sleep } from '$lib/internal/helpers/sleep';
import { derived, writable } from 'svelte/store';

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

	const ids = {
		menu: uuid(),
		trigger: uuid(),
	};

	const menu = elementDerived(
		[open, activeTrigger, options],
		([$open, $activeTrigger, $options], { addAction }) => {
			if ($open && $activeTrigger) {
				addAction(usePopper, {
					anchorElement: $activeTrigger,
					open,
					options: {
						floating: $options.positioning,
					},
				});
			}

			return {
				hidden: $open ? undefined : true,
				style: styleToString({
					display: $open ? undefined : 'none',
				}),
				'aria-labelledby': ids.trigger,
				role: 'menu',
			};
		}
	);

	const subMenu = elementMultiDerived([openSubMenus], ([$openSubMenus], { addAction }) => {
		return ({ id }: { id: string }) => {
			const isOpen = $openSubMenus.includes(id);
			console.log(isOpen);
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
				}

				return isOpen;
			});
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

	const subTrigger = elementMulti(({ attach }) => {
		return ({ menuId }: { menuId: string }) => {
			attach('click', () => {
				openSubMenus.update((prev) => {
					if (prev.includes(menuId)) {
						// remove menuId from array
						const newArr = prev.filter((id) => id !== menuId);
						return newArr;
					}
					return [...prev, menuId];
				});
			});

			attach('keydown', (e) => {
				if (e.key === kbd.ENTER || e.key === kbd.SPACE) {
					e.stopPropagation();
					e.stopImmediatePropagation();
					openSubMenus.update((prev) => {
						return [...prev, menuId];
					});
				}
			});

			attach('mouseover', (e) => {
				const el = e.currentTarget as HTMLElement;
				el.focus();
				openSubMenus.update((prev) => {
					if (prev.includes(menuId)) {
						// remove menuId from array
						return prev;
					}
					return [...prev, menuId];
				});
			});

			attach('mouseout', (e) => {
				const el = e.currentTarget as HTMLElement;
				el.blur();
				openSubMenus.update((prev) => {
					if (prev.includes(menuId)) {
						// remove menuId from array
						const newArr = prev.filter((id) => id !== menuId);
						return newArr;
					}
					return [...prev, menuId];
				});
			});

			return {
				role: 'menuitem',
				tabindex: 0,
				'aria-controls': menuId,
			};
		};
	});

	type ItemArgs = {
		value: string;
	};

	const item = elementMultiDerived([selected], ([$selected], { attach }) => {
		return ({ value }: ItemArgs) => {
			attach('click', (e) => {
				const el = e.currentTarget as HTMLElement;
				selected.set(value);
				selectedText.set(el.innerText);
				open.set(false);
			});

			attach('keydown', (e) => {
				if (e.key === kbd.ENTER || e.key === kbd.SPACE) {
					e.stopPropagation();
					e.stopImmediatePropagation();
					const el = e.currentTarget as HTMLElement;
					selected.set(value);
					selectedText.set(el.innerText);
					open.set(false);
				}
			});

			attach('mouseover', (e) => {
				const el = e.currentTarget as HTMLElement;
				el.focus();
			});

			attach('mouseout', (e) => {
				const el = e.currentTarget as HTMLElement;
				el.blur();
			});

			return {
				role: 'menuitem',
				'aria-selected': $selected === value,
				'data-selected': $selected === value ? '' : undefined,
				tabindex: 0,
			};
		};
	});

	let typed: string[] = [];
	const resetTyped = debounce(() => {
		typed = [];
	});

	effect([open], ([$open]) => {
		if (!$open) {
			openSubMenus.update(() => []);
		}
	});

	effect([open, menu, activeTrigger], ([$open, $menu, $activeTrigger]) => {
		if (!isBrowser) return;
		const menuEl = getElementByMeltId($menu['data-melt-id']);
		if (menuEl && $open) {
			// Focus on selected option or first option
			const selectedMenuItem = menuEl.querySelector('[data-selected]') as HTMLElement | undefined;
			if (!selectedMenuItem) {
				const firstItem = menuEl.querySelector('[role="menuitem"]') as HTMLElement | undefined;
				sleep(1).then(() => firstItem?.focus());
			} else {
				sleep(1).then(() => selectedMenuItem.focus());
			}

			const keydownListener = (e: KeyboardEvent) => {
				if (e.key === kbd.ESCAPE) {
					open.set(false);
					activeTrigger.set(null);
					return;
				}

				const allItems = Array.from(menuEl.querySelectorAll('[role="option"]')) as HTMLElement[];
				const focusedItem = allItems.find((el) => el === document.activeElement);
				const focusedIndex = allItems.indexOf(focusedItem as HTMLElement);

				if (e.key === kbd.ARROW_DOWN) {
					e.preventDefault();
					const nextIndex = focusedIndex + 1 > allItems.length - 1 ? 0 : focusedIndex + 1;
					const nextItem = allItems[nextIndex] as HTMLElement;
					nextItem.focus();
					return;
				} else if (e.key === kbd.ARROW_UP) {
					e.preventDefault();
					const prevIndex = focusedIndex - 1 < 0 ? allItems.length - 1 : focusedIndex - 1;
					const previtem = allItems[prevIndex] as HTMLElement;
					previtem.focus();
					return;
				} else if (e.key === kbd.HOME) {
					e.preventDefault();
					const firstItem = allItems[0] as HTMLElement;
					firstItem.focus();
					return;
				} else if (e.key === kbd.END) {
					e.preventDefault();
					const lastItem = allItems[allItems.length - 1] as HTMLElement;
					lastItem.focus();
					return;
				}

				// Typeahead
				const isAlphaNumericOrSpace = /^[a-z0-9 ]$/i.test(e.key);
				if (isAlphaNumericOrSpace) {
					typed.push(e.key.toLowerCase());
					const typedString = typed.join('');
					const matchItem = allItems.find((el) =>
						el.innerText.toLowerCase().startsWith(typedString)
					);
					if (matchItem) {
						matchItem.focus();
					}

					resetTyped();
				}
			};

			document.addEventListener('keydown', keydownListener);
			return () => {
				document.removeEventListener('keydown', keydownListener);
			};
		} else if (!$open && $activeTrigger && isBrowser) {
			// Hacky way to prevent the keydown event from triggering on the trigger
			sleep(1).then(() => $activeTrigger.focus());
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
