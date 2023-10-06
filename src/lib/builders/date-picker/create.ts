import {
	addMeltEventListener,
	builder,
	createElHelpers,
	effect,
	generateId,
	isBrowser,
	isHTMLElement,
	kbd,
	overridable,
	toWritableStores,
	omit,
	type ChangeFn,
	executeCallbacks,
	styleToString,
	chunk,
} from '$lib/internal/helpers/index.js';

import {
	isMatch,
	isSingleDate,
	isInSameMonth,
	getDaysBetween2,
	getLastFirstDayOfWeek2,
	getNextLastDayOfWeek2,
} from '$lib/builders/calendar/utils.js';

import { derived, get, writable, type Writable } from 'svelte/store';
import { createPopover, type Month } from '$lib/builders/index.js';
import type { CreateDatePickerProps } from './types.js';
import dayjs from 'dayjs';
import { dateStore, dayJsStore } from './date-store.js';
import { createSegments, handleSegmentNavigation, isSegmentNavigationKey } from './segments.js';
import { tick } from 'svelte';
import { createFormatter } from './formatter.js';
import {
	today,
	type DateValue,
	getLocalTimeZone,
	isToday,
	isSameMonth,
	isSameDay,
	startOfMonth,
	endOfMonth,
	ZonedDateTime,
	parseZonedDateTime,
	CalendarDateTime,
	parseDateTime,
	parseDate,
} from '@internationalized/date';
import { getDaysInMonth } from './utils.js';

const defaults = {
	disabled: false,
	unavailable: false,
	value: undefined,
	defaultFocusedValue: today(getLocalTimeZone()),
	focusedValue: undefined,
	allowDeselect: false,
	numberOfMonths: 1,
	pagedNavigation: false,
	weekStartsOn: 0,
	defaultValue: undefined,
	onValueChange: undefined,
	fixedWeeks: false,
	hourCycle: 24,
	positioning: {
		placement: 'bottom',
	},
	arrowSize: 8,
	defaultOpen: false,
	disableFocusTrap: false,
	closeOnEscape: true,
	preventScroll: false,
	onOpenChange: undefined,
	closeOnOutsideClick: true,
	portal: undefined,
	forceVisible: false,
	calendarLabel: 'Event Date',
	locale: 'en',
} satisfies CreateDatePickerProps;

const defaultTriggerAttrs = {
	'data-segment': '',
};

/**
 * For internal use only.
 * @internal
 */
export type _DatePickerParts =
	| 'content'
	| 'nextButton'
	| 'prevButton'
	| 'nextYear'
	| 'prevYear'
	| 'grid'
	| 'cell'
	| 'next'
	| 'prev'
	| 'dateField'
	| 'dayPeriod-segment'
	| 'segment'
	| 'heading'
	| 'trigger';

const { name } = createElHelpers<_DatePickerParts>('calendar');

/**
 * For internal use only.
 * @internal
 */
export type _DatePickerStores = {
	value: Writable<Date | undefined>;
	focusedValue: ReturnType<typeof dayJsStore>;
};

/**
 * For internal use only.
 * @internal
 */
export type _DatePickerIds = {
	grid: string;
	field: string;
	daySegment: string;
	monthSegment: string;
	yearSegment: string;
	hourSegment: string;
	minuteSegment: string;
	secondSegment: string;
	timeIndicatorSegment: string;
	accessibleHeading: string;
	content: string;
	trigger: string;
	calendar: string;
};

export function createDatePicker<T extends DateValue>(props?: CreateDatePickerProps<T>) {
	const withDefaults = { ...defaults, ...props };

	const popover = createPopover({
		positioning: withDefaults.positioning,
		arrowSize: withDefaults.arrowSize,
		defaultOpen: withDefaults.defaultOpen,
		open: withDefaults.open,
		disableFocusTrap: withDefaults.disableFocusTrap,
		closeOnEscape: withDefaults.closeOnEscape,
		preventScroll: withDefaults.preventScroll,
		onOpenChange: withDefaults.onOpenChange,
		closeOnOutsideClick: withDefaults.closeOnOutsideClick,
		portal: withDefaults.portal,
		forceVisible: withDefaults.forceVisible,
		attrs: {
			trigger: {
				...defaultTriggerAttrs,
			},
		},
		handlers: {
			trigger: {
				keydown: handleTriggerKeydown,
			},
		},
		focusTrap: {
			// We want to focus the focused date when the popover
			// is open regardless of the DOM order
			initialFocus: `[data-melt-calendar-cell][data-focused]`,
		},
	});

	const {
		states: { open },
	} = popover;

	const options = toWritableStores({
		...omit(withDefaults, 'value', 'focusedValue'),
		...popover.options,
	});

	const {
		allowDeselect,
		disabled,
		numberOfMonths,
		pagedNavigation,
		weekStartsOn,
		fixedWeeks,
		calendarLabel,
		unavailable,
		hourCycle,
		locale,
	} = options;

	const ids: _DatePickerIds = {
		calendar: generateId(),
		grid: generateId(),
		field: generateId(),
		daySegment: generateId(),
		monthSegment: generateId(),
		yearSegment: generateId(),
		hourSegment: generateId(),
		minuteSegment: generateId(),
		secondSegment: generateId(),
		timeIndicatorSegment: generateId(),
		accessibleHeading: generateId(),
		...popover.ids,
	};

	const valueWritable = withDefaults.value ?? writable(withDefaults.defaultValue);
	const value = overridable<DateValue | undefined>(
		valueWritable,
		withDefaults?.onValueChange as ChangeFn<DateValue | undefined>
	);

	const focusedValueWritable =
		withDefaults.focusedValue ?? writable(withDefaults.defaultFocusedValue);
	const focusedValue = dateStore(
		overridable(focusedValueWritable, withDefaults?.onFocusedValueChange)
	);

	const formatter = createFormatter(get(locale));

	const stores = {
		value,
		focusedValue,
		locale,
	};

	const months = writable<Month<T>[]>([createMonth(get(focusedValue) as T)]);

	const isInvalid = writable(false);

	const headingValue = derived([months, locale], ([$months, $locale]) => {
		if (!$months.length) return '';
		if ($locale !== formatter.getLocale()) {
			formatter.setLocale($locale);
		}
		if ($months.length === 1) {
			const month = $months[0].monthDate;
			return `${formatter.fullMonthAndYear(month)}`;
		}

		const startMonth = $months[0].monthDate;
		const endMonth = $months[$months.length - 1].monthDate;

		const startMonthName = formatter.fullMonth(startMonth);
		const endMonthName = formatter.fullMonth(endMonth);
		const startMonthYear = formatter.fullYear(startMonth);
		const endMonthYear = formatter.fullYear(endMonth);

		const content =
			startMonthYear === endMonthYear
				? `${startMonthName} - ${endMonthName} ${endMonthYear}`
				: `${startMonthName} ${startMonthYear} - ${endMonthName} ${endMonthYear}`;

		return content;
	});

	const fullCalendarLabel = derived(
		[headingValue, calendarLabel],
		([$headingValue, $calendarLabel]) => {
			return `${$calendarLabel}, ${$headingValue}`;
		}
	);

	const calendar = builder(name(), {
		stores: [fullCalendarLabel, isInvalid],
		returned: ([$fullCalendarLabel, $isInvalid]) => {
			return {
				id: ids.calendar,
				role: 'application',
				'aria-label': $fullCalendarLabel,
				'data-invalid': $isInvalid ? '' : undefined,
			};
		},
		action: (node: HTMLElement) => {
			/**
			 * Create the accessible heading for the calendar
			 * when the grid is mounted. The label is updated
			 * via an effect when the active date or label changes.
			 */
			createAccessibleHeading(node, get(fullCalendarLabel));

			const unsubKb = addMeltEventListener(node, 'keydown', handleCalendarKeydown);

			return {
				destroy() {
					unsubKb();
				},
			};
		},
	});

	const heading = builder(name('heading'), {
		returned: () => {
			return {
				'aria-hidden': true,
			};
		},
	});

	const grid = builder(name('grid'), {
		returned: () => ({ tabindex: -1, id: ids.grid, role: 'grid' }),
	});

	const dateField = builder(name('dateField'), {
		returned: () => {
			return {
				role: 'group',
				id: ids.field,
			};
		},
	});

	const prevButton = builder(name('prevButton'), {
		returned: () => {
			return {
				role: 'button',
				'aria-label': 'Previous',
			};
		},
		action: (node: HTMLElement) => {
			const unsub = executeCallbacks(
				addMeltEventListener(node, 'click', () => {
					prevPage();
				})
			);
			return {
				destroy: unsub,
			};
		},
	});

	const nextButton = builder(name('nextButton'), {
		returned: () => {
			return {
				role: 'button',
				'aria-label': 'Next',
			};
		},
		action: (node: HTMLElement) => {
			const unsub = executeCallbacks(
				addMeltEventListener(node, 'click', () => {
					nextPage();
				})
			);
			return {
				destroy: unsub,
			};
		},
	});

	/**
	 * An individual date cell in the calendar grid, which represents a
	 * single day in the month.
	 */
	const cell = builder(name('cell'), {
		stores: [value, disabled, unavailable, focusedValue],
		returned: ([$value, $disabled, $unavailable, $focusedValue]) => {
			return (cellValue: T) => {
				// TODO: Handle ability to set timezone via props or default
				// to local timezone
				const cellDate = cellValue.toDate(getLocalTimeZone());

				const isDisabled = isMatch(cellDate, $disabled);
				const isUnavailable = isMatch(cellDate, $unavailable);
				const isDateToday = isToday(cellValue, getLocalTimeZone());
				const isOutsideMonth = isSameMonth(cellValue, $focusedValue ?? new Date());

				const isFocusedDate = isSameDay(cellValue, $focusedValue);
				const isSelectedDate = $value ? isSameDay(cellValue, $value) : false;

				const labelText = formatter.custom(cellValue.toDate(getLocalTimeZone()), {
					weekday: 'long',
					month: 'long',
					day: 'numeric',
					year: 'numeric',
				});

				return {
					role: 'button',
					'aria-label': labelText,
					'aria-selected': isSelectedDate ? true : undefined,
					'aria-disabled': isOutsideMonth ? true : undefined,
					'data-selected': isSelectedDate ? true : undefined,
					'data-value': cellValue,
					'data-disabled': isDisabled || isOutsideMonth ? '' : undefined,
					'data-unavailable': isUnavailable ? '' : undefined,
					'data-date': '',
					'data-today': isDateToday ? '' : undefined,
					'data-outside-month': isOutsideMonth ? '' : undefined,
					'data-focused': isFocusedDate ? '' : undefined,
					tabindex: isFocusedDate ? 0 : isOutsideMonth || isDisabled ? undefined : -1,
				} as const;
			};
		},
		action: (node: HTMLElement) => {
			const getElArgs = () => {
				const value = node.getAttribute('data-value');
				const label = node.getAttribute('data-label');
				const disabled = node.hasAttribute('data-disabled');

				return {
					value,
					label: label ?? node.textContent ?? null,
					disabled: disabled ? true : false,
				};
			};
			const unsub = executeCallbacks(
				addMeltEventListener(node, 'click', () => {
					const args = getElArgs();
					if (args.disabled) return;
					const date = new Date(args.value || '');
					handleSingleClick(date);
				})
			);

			return {
				destroy: unsub,
			};
		},
	});

	const segments = createSegments({
		stores,
		ids,
		options: {
			hourCycle,
		},
		formatter,
	});

	effect([locale], ([$locale]) => {
		if (formatter.getLocale() === $locale) return;
		formatter.setLocale($locale);
	});

	effect([focusedValue], ([$focusedValue]) => {
		if (!isBrowser || !$focusedValue) return;

		months.set([createMonth($focusedValue as T)]);
		const $numberOfMonths = get(numberOfMonths);
		if ($numberOfMonths > 1) {
			const d = dayjs($focusedValue);

			for (let i = 1; i < $numberOfMonths; i++) {
				const nextMonth = d.add(i, 'month').toDate();
				months.update((prev) => {
					prev.push(createMonth(nextMonth));
					return prev;
				});
			}
		}
	});

	/**
	 * Update the accessible heading's text content when the
	 * `fullCalendarLabel` store changes.
	 */
	effect([fullCalendarLabel], ([$fullCalendarLabel]) => {
		if (!isBrowser) return;
		const node = document.getElementById(ids.accessibleHeading);
		if (!isHTMLElement(node)) return;
		node.textContent = $fullCalendarLabel;
	});

	effect([open, value], ([$open, $value]) => {
		if (!$open || !$value) {
			focusedValue.reset();
			return;
		}

		if ($value && get(focusedValue) !== $value) {
			focusedValue.set($value);
		}
	});

	/**
	 * A derived store whose value is an array of dates that represent
	 * the days of the week, used to render the days of the week in the
	 * calendar header.
	 *
	 * It returns the days of the week from the first week of the first
	 * month in the calendar view.
	 *
	 * This remains in sync with the `weekStartsOn` option, so if it is
	 * changed, this store and the calendar will update accordingly.
	 */
	const daysOfWeek = derived([months], ([$months]) => {
		if (!$months.length) return [];
		return $months[0].weeks[0];
	});

	/**
	 * Given a date, this function will return an object containing
	 * the necessary values to render a calendar month, including
	 * the month's date, which can be used to render the name of the
	 * month, the dates within that month, and the dates from the
	 * previous and next months that are needed to fill out the
	 * calendar grid.
	 */
	function createMonth(dateObj: T): Month<T> {
		const tz = getLocalTimeZone();
		const date = dateObj.toDate(tz);
		const daysInMonth = getDaysInMonth(date);

		const datesArray = Array.from({ length: daysInMonth }, (_, i) => dateObj.set({ day: i + 1 }));

		const firstDayOfMonth = startOfMonth(dateObj);
		const lastDayOfMonth = endOfMonth(dateObj);

		const lastSunday = getLastFirstDayOfWeek2(firstDayOfMonth, get(weekStartsOn), get(locale));
		const nextSaturday = getNextLastDayOfWeek2(lastDayOfMonth, get(weekStartsOn), get(locale));

		const lastMonthDays = getDaysBetween2(lastSunday.subtract({ days: 1 }), firstDayOfMonth);
		const nextMonthDays = getDaysBetween2(lastDayOfMonth, nextSaturday.add({ days: 1 }));

		const totalDays = lastMonthDays.length + datesArray.length + nextMonthDays.length;

		if (get(fixedWeeks) && totalDays < 42) {
			const extraDays = 42 - totalDays;

			const startFrom = nextMonthDays[nextMonthDays.length - 1];
			const extraDaysArray = Array.from({ length: extraDays }, (_, i) => {
				const incr = i + 1;
				return startFrom.add({ days: incr });
			});
			nextMonthDays.push(...extraDaysArray);
		}

		const allDays = lastMonthDays.concat(datesArray, nextMonthDays) as T[];

		const weeks = chunk(allDays, 7);

		return {
			monthDate: date,
			dates: allDays,
			weeks,
		};
	}

	function createAccessibleHeading(node: HTMLElement, label: string) {
		if (!isBrowser) return;
		const div = document.createElement('div');
		div.style.cssText = styleToString({
			border: '0px',
			clip: 'rect(0px, 0px, 0px, 0px)',
			'clip-path': 'inset(50%)',
			height: '1px',
			margin: '-1px',
			overflow: 'hidden',
			padding: '0px',
			position: 'absolute',
			'white-space': 'nowrap',
			width: '1px',
		});
		const h2 = document.createElement('h2');
		h2.textContent = label;
		h2.id = ids.accessibleHeading;
		node.insertBefore(div, node.firstChild);
		div.appendChild(h2);
	}

	/**
	 * Navigate to the next page of the calendar.
	 * If using paged navigation, this will move the calendar forward
	 * by the number of months specified in the `numberOfMonths` prop.
	 * If not using paged navigation, this will move the calendar forward
	 * by one month.
	 */
	function nextPage() {
		if (get(pagedNavigation)) {
			const $numberOfMonths = get(numberOfMonths);
			focusedValue.add({ months: $numberOfMonths });
		} else {
			focusedValue.add({ months: 1 });
		}
	}

	/**
	 * Navigate to the previous page of the calendar.
	 * If using paged navigation, this will move the calendar backwards
	 * by the number of months specified in the `numberOfMonths` prop.
	 * If not using paged navigation, this will move the calendar backwards
	 * by one month.
	 */
	function prevPage() {
		if (get(pagedNavigation)) {
			const $numberOfMonths = get(numberOfMonths);
			focusedValue.subtract({ months: $numberOfMonths });
		} else {
			focusedValue.subtract({ months: 1 });
		}
	}

	/**
	 * Navigate to the previous year of the calendar.
	 */
	function nextYear() {
		focusedValue.add({ years: 1 });
	}

	/**
	 * Navigate to the next year of the calendar.
	 */
	function prevYear() {
		focusedValue.subtract({ years: 1 });
	}

	const ARROW_KEYS = [kbd.ARROW_DOWN, kbd.ARROW_UP, kbd.ARROW_LEFT, kbd.ARROW_RIGHT];

	function handleTriggerKeydown(e: KeyboardEvent) {
		if (isSegmentNavigationKey(e.key)) {
			e.preventDefault();
			handleSegmentNavigation(e, ids.field);
		}
	}

	/**
	 * A helper function to set the year of the active date. This is
	 * useful when the user wants to have a select input to change the
	 * year of the calendar.
	 */
	function setYear(year: number) {
		focusedValue.setDate({ year: year });
	}

	/**
	 * A helper function to set the month of the active date. This is
	 * useful when the user wants to have a select input to change the
	 * month of the calendar.
	 */
	function setMonth(month: number) {
		if (month < 0 || month > 11) throw new Error('Month must be between 0 and 11');
		focusedValue.setDate({ month: month });
	}

	function handleSingleClick(date: Date) {
		value.update((prev) => {
			if (isSingleDate(prev) || prev === undefined) {
				const $focusedValue = get(focusedValue);
				if ($focusedValue && !isInSameMonth(date, $focusedValue)) {
					focusedValue.set(date);
				}

				if (prev === undefined) return date;
				if (get(allowDeselect) && isSameDay(prev, date)) {
					focusedValue.set(date);
					return undefined;
				}
			}
			return date;
		});
	}

	const SELECT_KEYS = [kbd.ENTER, kbd.SPACE];

	function handleCalendarKeydown(e: KeyboardEvent) {
		const currentCell = e.target;
		if (!isCalendarCell(currentCell)) return;
		if (!ARROW_KEYS.includes(e.key) && !SELECT_KEYS.includes(e.key)) return;

		e.preventDefault();
		// the cell that is currently focused

		if (e.key === kbd.ARROW_DOWN) {
			shiftFocus(currentCell, 7);
		}
		if (e.key === kbd.ARROW_UP) {
			shiftFocus(currentCell, -7);
		}
		if (e.key === kbd.ARROW_LEFT) {
			shiftFocus(currentCell, -1);
		}
		if (e.key === kbd.ARROW_RIGHT) {
			shiftFocus(currentCell, 1);
		}

		if (e.key === kbd.SPACE || e.key === kbd.ENTER) {
			handleSingleClick(new Date(currentCell.getAttribute('data-value') ?? ''));
		}
	}

	function shiftFocus(node: HTMLElement, add: number) {
		// TODO: Determine if this is okay when using paged navigation
		// with multiple months.
		const candidateCells = getSelectableCells();
		if (!candidateCells.length) {
			return;
		}

		const index = candidateCells.indexOf(node);
		const nextIndex = index + add;

		/**
		 * If the next cell is within the bounds of the
		 * displayed/rendered cells, easy day, just focus it.
		 */
		if (isValidIndex(nextIndex, candidateCells)) {
			const nextCell = candidateCells[nextIndex];
			handleFocusedValue(nextCell);
			return nextCell.focus();
		}

		/**
		 * If the next cell is outside the bounds of the
		 * displayed/rendered cells, we need to updated the focused
		 * value to the prev/next month depending on the direction,
		 * and then focus the appropriate cell.
		 */

		if (nextIndex < 0) {
			/**
			 * Since we're in the negative index range, we need to
			 * go back a month, refetch the candidate cells within that
			 * month, and then starting at the end of that array, shift
			 * focus by the difference between the nextIndex
			 */

			// shift the calendar back a month
			focusedValue.subtract(1, 'month');

			// Without a tick here, it seems to be too fast for
			// the DOM to update, with the tick it works great
			tick().then(() => {
				const newCandidateCells = getSelectableCells();
				if (!newCandidateCells.length) {
					return;
				}

				// starting at the end of the array, shift focus by the nextIndex amount
				// since in this case, nextIndex is negative, we'll convert it to a positive
				// before subtracting it from the length of the array
				const newIndex = newCandidateCells.length - Math.abs(nextIndex);
				if (isValidIndex(newIndex, newCandidateCells)) {
					const newCell = newCandidateCells[newIndex];
					handleFocusedValue(newCell);
					return newCell.focus();
				}
			});
		}

		if (nextIndex >= candidateCells.length) {
			/**
			 * Since we're in the positive index range, we need to
			 * go forward a month, refetch the candidate cells within that
			 * month, and then starting at the beginning of that array,
			 * shift focus by the nextIndex amount.
			 */

			// shift the calendar forward a month
			focusedValue.add(1, 'month');

			// we may need a tick here, but we'll see how it goes
			tick().then(() => {
				const newCandidateCells = getSelectableCells();
				if (!newCandidateCells.length) {
					return;
				}

				// We need to determine how far into the next month we need to go
				// to get the next index. So if we only went over the previous
				// month by 1, we need to go into the next month by 1 to get the
				// right index.
				const newIndex = nextIndex - candidateCells.length;

				if (isValidIndex(newIndex, newCandidateCells)) {
					const nextCell = newCandidateCells[newIndex];
					return nextCell.focus();
				}
			});
		}
	}

	function getSelectableCells() {
		const node = document.getElementById(ids.calendar);
		if (!node) return [];

		return Array.from(
			node.querySelectorAll(
				`[data-melt-calendar-cell]:not([data-disabled]):not([data-outside-month])`
			)
		).filter((el): el is HTMLElement => isHTMLElement(el));
	}

	/**
	 * A helper function to extract the date from the `data-value`
	 * attribute of a date cell and set it as the focused value.
	 */
	function handleFocusedValue(node: HTMLElement) {
		const cellValue = node.getAttribute('data-value');
		if (!cellValue) return;
		focusedValue.set(new Date(cellValue));
	}

	function parseToDateObj(dateStr: string) {
		const $focusedValue = get(focusedValue);
		if ($focusedValue instanceof ZonedDateTime) {
			return parseZonedDateTime(dateStr);
		}
		if ($focusedValue instanceof CalendarDateTime) {
			return parseDateTime(dateStr);
		}
		return parseDate(dateStr);
	}

	return {
		elements: {
			calendar,
			heading,
			grid,
			cell,
			dateField,
			nextButton,
			prevButton,
			...segments.elements,
			...popover.elements,
		},
		states: {
			focusedValue: {
				subscribe: focusedValue.subscribe,
				set: focusedValue.set,
				update: focusedValue.update,
			},
			months,
			value,
			daysOfWeek,
			headingValue,
			...segments.states,
			...popover.states,
		},
		helpers: {
			nextPage,
			prevPage,
			nextYear,
			prevYear,
			setYear,
			setMonth,
		},
		options,
		ids,
	};
}

function isValidIndex(index: number, arr: unknown[]) {
	return index >= 0 && index < arr.length;
}

function isCalendarCell(node: unknown): node is HTMLElement {
	if (!isHTMLElement(node)) return false;
	if (!node.hasAttribute('data-melt-calendar-cell')) return false;
	return true;
}
