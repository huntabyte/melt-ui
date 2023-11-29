export const isBrowser = typeof document !== 'undefined';
// eslint-disable-next-line @typescript-eslint/ban-types
export const isFunction = (v: unknown): v is Function => typeof v === 'function';

export const isLetter = (key: string) => /^[a-z]$/i.test(key);

export function isElement(element: unknown): element is Element {
	return element instanceof Element;
}

export function isHTMLElement(element: unknown): element is HTMLElement {
	return element instanceof HTMLElement;
}

export function isSVGElement(element: unknown): element is SVGElement {
	return element instanceof SVGElement;
}

export function isHTMLOrSVGElement(element: unknown): element is HTMLElement | SVGElement {
	return isHTMLElement(element) || isSVGElement(element);
}

export function isHTMLInputElement(element: unknown): element is HTMLInputElement {
	return element instanceof HTMLInputElement;
}

export function isHTMLLabelElement(element: unknown): element is HTMLLabelElement {
	return element instanceof HTMLLabelElement;
}

export function isHTMLButtonElement(element: unknown): element is HTMLButtonElement {
	return element instanceof HTMLButtonElement;
}

export function isElementDisabled(element: HTMLElement): boolean {
	const ariaDisabled = element.getAttribute('aria-disabled');
	const disabled = element.getAttribute('disabled');
	const dataDisabled = element.hasAttribute('data-disabled');

	if (ariaDisabled === 'true' || disabled !== null || dataDisabled) {
		return true;
	}

	return false;
}

export function isTouch(event: PointerEvent): boolean {
	return event.pointerType === 'touch';
}

export function isLeftClick(event: PointerEvent | MouseEvent): boolean {
	return event.button === 0 && event.ctrlKey === false && event.metaKey === false;
}

export function isFocusVisible(element: Element): boolean {
	return element.matches(':focus-visible');
}

export function isContentEditable(element: unknown): element is HTMLElement {
	if (!isHTMLElement(element)) return false;
	return element.isContentEditable;
}

export function isNull(value: unknown): value is null {
	return value === null;
}

export function isNumberString(value: string) {
	if (isNaN(parseInt(value))) return false;
	return true;
}

export function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object';
}

function testUserAgent(re: RegExp) {
	if (typeof window === 'undefined' || window.navigator == null) return false;
	return (
		window.navigator['userAgentData']?.brands.some((brand: { brand: string; version: string }) =>
			re.test(brand.brand)
		) || re.test(window.navigator.userAgent)
	);
}

function testPlatform(re: RegExp) {
	if (typeof window === 'undefined' || window.navigator == null) return false;
	return re.test(window.navigator['userAgentData']?.platform || window.navigator.platform);
}

export function isMac() {
	return testPlatform(/^Mac/i);
}

export function isPhone() {
	return testPlatform(/^iPhone/i);
}

export function isIPad() {
	// iPadOS 13 lies about its user agent & says it's a Mac so we check for touch support too
	return testPlatform(/^iPad/i) || (isMac() && navigator.maxTouchPoints > 1);
}

export function isIOS() {
	return isPhone() || isIPad();
}

export function isAppleDevice() {
	return isMac() || isIOS();
}

export function isChrome() {
	return testUserAgent(/Chrome/i);
}

export function isWebKit() {
	return testUserAgent(/AppleWebKit/i) && !isChrome();
}

export function isAndroid() {
	return testUserAgent(/Android/i);
}

export function isFirefox() {
	return testUserAgent(/Firefox/i);
}

// Keyboards, Assistive Technologies, and element.click() all produce a "virtual"
// click event. This is a method of inferring such clicks. Every browser except
// IE 11 only sets a zero value of "detail" for click events that are "virtual".
// However, IE 11 uses a zero value for all click events. For IE 11 we rely on
// the quirk that it produces click events that are of type PointerEvent, and
// where only the "virtual" click lacks a pointerType field.

export function isVirtualClick(event: MouseEvent | PointerEvent): boolean {
	// JAWS/NVDA with Firefox.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if ((event as any).mozInputSource === 0 && event.isTrusted) {
		return true;
	}

	// Android TalkBack's detail value varies depending on the event listener providing the event so we have specific logic here instead
	// If pointerType is defined, event is from a click listener. For events from mousedown listener, detail === 0 is a sufficient check
	// to detect TalkBack virtual clicks.
	if (isAndroid() && (event as PointerEvent).pointerType) {
		return event.type === 'click' && event.buttons === 1;
	}

	return event.detail === 0 && !(event as PointerEvent).pointerType;
}
