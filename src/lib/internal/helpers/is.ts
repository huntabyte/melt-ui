export const isBrowser = typeof document !== 'undefined';
// eslint-disable-next-line @typescript-eslint/ban-types
export const isFunction = (v: unknown): v is Function => typeof v === 'function';

export function isHTMLElement(element: unknown): element is HTMLElement {
	return element instanceof HTMLElement;
}

export function isDescendantElement(element: HTMLElement, selector: string) {
	const ancestor = element.closest(selector);
	return ancestor !== null;
}
