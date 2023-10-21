import {
	createElHelpers,
	toWritableStores,
	omit,
	overridable,
	generateId,
	builder,
	executeCallbacks,
	addMeltEventListener,
	kbd,
	isHTMLElement,
	isUndefined,
	effect,
	isHTMLInputElement,
} from '$lib/internal/helpers';
import { derived, get, writable, type Writable } from 'svelte/store';
import type { CreateCommandMenuProps } from '.';
import { commandScore } from './command-score';

type CommandMenuParts =
	| 'list'
	| 'item'
	| 'input'
	| 'group'
	| 'separator'
	| 'empty'
	| 'loading'
	| 'group-items'
	| 'group-heading'
	| 'list-sizer';

const { name } = createElHelpers<CommandMenuParts>('command-menu');

const defaults = {
	label: 'Command menu',
	shouldFilter: true,
	loop: false,
	defaultValue: undefined,
	onValueChange: undefined,
	value: undefined,
	filter: (value, search) => commandScore(value, search),
} satisfies CreateCommandMenuProps;

type State = {
	search: string;
	value: string;
	filtered: { count: number; items: Map<string, number>; groups: Set<string> };
};

const LIST_SELECTOR = `[${name('list')}]`;
const GROUP_SELECTOR = `[${name('group')}]`;
const GROUP_ITEMS_SELECTOR = `[${name('group-items')}]`;
const GROUP_HEADING_SELECTOR = `[${name('group-heading')}]`;
const ITEM_SELECTOR = `[${name('item')}]`;
const VALID_ITEM_SELECTOR = `${ITEM_SELECTOR}:not([aria-disabled="true"])`;
const VALUE_ATTR = 'data-value';

export function createCommandMenu(props?: CreateCommandMenuProps) {
	const withDefaults = { ...defaults, ...props } satisfies CreateCommandMenuProps;

	const options = toWritableStores(omit(withDefaults, 'value', 'defaultValue'));
	const { loop, filter, label, shouldFilter } = options;

	const valueWritable = withDefaults.value ?? writable(withDefaults.defaultValue);
	const value = overridable(valueWritable, withDefaults.onValueChange);
	const allItems = writable<Set<string>>(new Set());
	const allGroups = writable<Map<string, Set<string>>>(new Map());
	const allIds = writable<Map<string, string>>(new Map());

	// Use within the resize observer in the list sizer
	const listEl = writable<HTMLElement | null>(null);

	const ids = {
		root: generateId(),
		list: generateId(),
		label: generateId(),
		input: generateId(),
	};

	const state = writable<State>({
		/**
		 * The current search query.
		 */
		search: '',
		/**
		 * Currently selected value of the command menu.
		 */
		value: get(value) ?? withDefaults.defaultValue?.toLowerCase() ?? '',
		filtered: {
			/**
			 * The number of all visible items
			 */
			count: 0,
			/**
			 * Map of all visible items and their scores
			 */
			items: new Map(),
			/**
			 * Set of groups with at least one visible item
			 */
			groups: new Set(),
		},
	});

	// Keep track of the selected item's ID as the state changes
	const selectedItemId = derived(state, ($state) => {
		const value = $state.value;
		const rootEl = document.getElementById(ids.root);
		if (!rootEl) return '';
		const item = rootEl.querySelector(`${ITEM_SELECTOR}[${VALUE_ATTR}="${value}"]`);
		if (!isHTMLElement(item) || !item.id) return '';
		return item.id;
	});

	const root = builder(name(), {
		returned: () => {
			return {
				id: ids.root,
			};
		},
		action: (node: HTMLElement) => {
			const unsubEvents = executeCallbacks(
				addMeltEventListener(node, 'keydown', handleRootKeydown)
			);

			return {
				destroy() {
					unsubEvents();
				},
			};
		},
	});

	const input = builder(name('input'), {
		stores: [selectedItemId],
		returned: ([$selectedItemId]) => {
			return {
				id: ids.input,
				autocomplete: 'off',
				autocorrect: 'off',
				spellcheck: 'false',
				'aria-autocomplete': 'list',
				role: 'combobox',
				'aria-expanded': 'true',
				'aria-controls': ids.list,
				'aria-labelledby': ids.label,
				'aria-activedescendant': $selectedItemId ? $selectedItemId : undefined,
				type: 'text',
				value: get(state).search,
			};
		},
		action: (node: HTMLInputElement) => {
			const unsubEvents = executeCallbacks(addMeltEventListener(node, 'change', handleInputChange));

			return {
				destroy() {
					unsubEvents();
				},
			};
		},
	});

	const list = builder(name('list'), {
		returned: () => {
			return {
				role: 'listbox',
				id: ids.list,
				'aria-label': 'Suggestions',
				'aria-labelledby': ids.input,
			};
		},
		action: (node: HTMLElement) => {
			listEl.set(node);

			return {
				destroy() {
					if (get(listEl) === node) {
						listEl.set(null);
					}
				},
			};
		},
	});

	const listSizer = builder(name('list-sizer'), {
		returned: () => {
			return {};
		},
		action: (node: HTMLElement) => {},
	});

	const group = builder(name('group'), {
		returned: () => {
			const groupId = generateId();
			return {
				id: groupId,
				role: 'presentation',
			};
		},
	});

	const groupHeading = builder(name('group-heading'), {
		returned: () => {
			const headingId = generateId();
			return {
				id: headingId,
			};
		},
		action: (node: HTMLElement) => {
			// TODO: create accessible heading here.
		},
	});

	effect([value], ([$value]) => {
		if (!$value) {
			updateState('value', '');
			return;
		}
		const $stateValue = get(state).value;
		const lowerCaseValue = $value.toLowerCase();

		if ($stateValue !== lowerCaseValue) {
			updateState('value', lowerCaseValue);
		}
	});

	effect([state], ([$state]) => {
		if ($state.value && get(value)?.toLowerCase() !== $state.value) {
			value.set($state.value);
		}
	});

	function handleInputChange(e: Event) {
		if (!isHTMLInputElement(e.target)) return;
		updateState('search', e.target.value);
	}

	function handleRootKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case kbd.ARROW_DOWN:
				// next(e)
				break;
			case kbd.ARROW_UP:
				// previous(e)
				break;
			case kbd.HOME:
				// first item
				e.preventDefault();
				// updateSelectedToIndex(0)
				break;
			case kbd.END:
				// last item
				e.preventDefault();
				// last()
				break;
			case kbd.ENTER:
				e.preventDefault();
			// const item = getSelectedItem()
			// if (item) {
			//
			//	}
		}
	}

	function updateState<K extends keyof State>(key: K, value: State[K]) {
		const $shouldFilter = get(shouldFilter);
		state.update((curr) => {
			if (Object.is(curr[key], value)) return curr;
			curr[key] = value;

			if (key === 'search') {
				const filteredState = filterItems(curr, $shouldFilter);
				if (filteredState) {
					curr = filteredState;
				}
				const sortedState = sort(curr, $shouldFilter);
				if (sortedState) {
					curr = sortedState;
				}
			}
			return curr;
		});
	}

	function filterItems(state: State, $shouldFilter: boolean) {
		const $allItems = get(allItems);
		const $allIds = get(allIds);
		if (!state.search || !$shouldFilter) {
			state.filtered.count = $allItems.size;
			return;
		}

		state.filtered.groups = new Set();
		let itemCount = 0;

		// check which items should be included
		for (const id of $allItems) {
			const value = $allIds.get(id);
			const rank = score(value, state.search);
			state.filtered.items.set(id, rank);
			if (rank > 0) {
				itemCount++;
			}
		}

		// Check which groups have at least 1 item shown
		for (const [groupId, group] of get(allGroups)) {
			for (const itemId of group) {
				const rank = state.filtered.items.get(itemId);
				if (rank && rank > 0) {
					state.filtered.groups.add(groupId);
				}
			}
		}

		state.filtered.count = itemCount;
		return state;
	}

	function sort(state: State, $shouldFilter: boolean) {
		if (!state.search || !$shouldFilter) {
			return state;
		}

		const scores = state.filtered.items;

		// sort groups
		const groups: [string, number][] = [];
		const $allGroups = get(allGroups);

		state.filtered.groups.forEach((value) => {
			const items = $allGroups.get(value);
			if (!items) return;
			// get max score of the group's items
			let max = 0;
			items.forEach((item) => {
				const score = scores.get(item);
				if (isUndefined(score)) return;
				max = Math.max(score, max);
			});
			groups.push([value, max]);
		});

		// Sort items within groups to bottom
		// sort items outside of groups
		// sort groups to bottom (pushed all non-grouped items to the top)
		const rootEl = document.getElementById(ids.root);
		if (!rootEl) return state;
		const list = rootEl.querySelector(LIST_SELECTOR);

		// Sort the items
		getValidItems(rootEl)
			.sort((a, b) => {
				const valueA = a.getAttribute(VALUE_ATTR) ?? '';
				const valueB = b.getAttribute(VALUE_ATTR) ?? '';
				return (scores.get(valueA) ?? 0) - (scores.get(valueB) ?? 0);
			})
			.forEach((item) => {
				const group = item.closest(GROUP_ITEMS_SELECTOR);
				const closest = item.closest(`${GROUP_ITEMS_SELECTOR} > *`);
				if (isHTMLElement(group)) {
					if (item.parentElement === group) {
						group.appendChild(item);
					} else {
						if (!isHTMLElement(closest)) return;
						group.appendChild(closest);
					}
				} else {
					if (!isHTMLElement(list)) return;
					if (item.parentElement === list) {
						list.appendChild(item);
					} else {
						if (!isHTMLElement(closest)) return;
						list.appendChild(closest);
					}
				}
			});

		groups
			.sort((a, b) => b[1] - a[1])
			.forEach((group) => {
				const el = rootEl.querySelector(`${GROUP_SELECTOR}[${VALUE_ATTR}="${group[0]}"]`);
				if (!isHTMLElement(el)) return;
				el.parentElement?.appendChild(el);
			});
	}

	function selectFirstItem() {
		const item = getValidItems().find((item) => !item.ariaDisabled);
		if (!item) return;
		const value = item.getAttribute(VALUE_ATTR);
		if (!value) return;
		updateState('value', value);
	}

	function score(value: string | undefined, search: string) {
		const filterFn = get(filter);
		return value ? filterFn(value, search) : 0;
	}

	function scrollSelectedIntoView() {
		const item = getSelectedItem();
		if (!item) return;
		if (item.parentElement?.firstChild === item) {
			item.closest(GROUP_SELECTOR)?.querySelector(GROUP_HEADING_SELECTOR)?.scrollIntoView({
				block: 'nearest',
			});
		}

		item.scrollIntoView({ block: 'nearest' });
	}

	function getValidItems(rootElement?: HTMLElement) {
		const rootEl = rootElement ?? document.getElementById(ids.root);
		if (!rootEl) return [];
		return Array.from(rootEl.querySelectorAll(VALID_ITEM_SELECTOR)).filter(
			(el): el is HTMLElement => isHTMLElement(el)
		);
	}

	function getSelectedItem(rootElement?: HTMLElement) {
		const rootEl = rootElement ?? document.getElementById(ids.root);
		if (!rootEl) return;
		const selectedEl = rootEl.querySelector(`${VALID_ITEM_SELECTOR}[aria-selected="true"]`);
		if (!isHTMLElement(selectedEl)) return null;
		return selectedEl;
	}

	function updateSelectedToIndex(index: number) {
		const rootEl = document.getElementById(ids.root);
		if (!rootEl) return;
		const items = getValidItems(rootEl);
		const item = items[index];
		if (!item) return;
	}

	function updateSelectedByChange(change: 1 | -1) {
		const selected = getSelectedItem();
		const items = getValidItems();
		const index = items.findIndex((item) => item === selected);

		// get item at this index
		let newSelected = items[index + change];

		if (get(loop)) {
			if (index + change < 0) {
				newSelected = items[items.length - 1];
			} else if (index + change === items.length) {
				newSelected = items[0];
			} else {
				newSelected = items[index + change];
			}
		}

		if (newSelected) {
			updateState('value', newSelected.getAttribute(VALUE_ATTR) ?? '');
		}
	}

	function updateSelectedToGroup(change: 1 | -1) {
		const selected = getSelectedItem();
		let group = selected?.closest(GROUP_SELECTOR);
		let item: HTMLElement | undefined | null = undefined;

		while (group && !item) {
			group =
				change > 0
					? findNextSibling(group, GROUP_SELECTOR)
					: findPreviousSibling(group, GROUP_SELECTOR);
			item = group?.querySelector(VALID_ITEM_SELECTOR);
		}

		if (item) {
			updateState('value', item.getAttribute(VALUE_ATTR) ?? '');
		} else {
			updateSelectedByChange(change);
		}
	}

	function last() {
		return updateSelectedToIndex(getValidItems().length - 1);
	}

	function next(e: KeyboardEvent) {
		e.preventDefault();

		if (e.metaKey) {
			last();
		} else if (e.altKey) {
			updateSelectedToGroup(1);
		} else {
			updateSelectedByChange(1);
		}
	}

	function prev(e: KeyboardEvent) {
		e.preventDefault();

		if (e.metaKey) {
			updateSelectedToIndex(0);
		} else if (e.altKey) {
			updateSelectedToGroup(-1);
		} else {
			updateSelectedByChange(-1);
		}
	}

	return {
		elements: {
			root,
			input,
			group,
			groupHeading,
			list,
			listSizer,
		},
		options,
	};
}

function findNextSibling(el: Element, selector: string) {
	let sibling = el.nextElementSibling;

	while (sibling) {
		if (sibling.matches(selector)) return sibling;
		sibling = sibling.nextElementSibling;
	}
}

function findPreviousSibling(el: Element, selector: string) {
	let sibling = el.previousElementSibling;

	while (sibling) {
		if (sibling.matches(selector)) return sibling;
		sibling = sibling.previousElementSibling;
	}
}
