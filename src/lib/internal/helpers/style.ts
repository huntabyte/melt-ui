/**
 * A utility function that converts a style object to a string.
 *
 * @param style - The style object to convert
 * @returns The style object as a string
 */
export function styleToString(style: Record<string, number | string | undefined>): string {
	return Object.keys(style).reduce((str, key) => {
		if (style[key] === undefined) return str;
		return str + `${key}:${style[key]};`;
	}, '');
}

/**
 * Screen reader only styles
 */
export const srOnlyStyles = {
	position: 'absolute',
	width: '1px',
	height: '1px',
	padding: '0',
	margin: '-1px',
	overflow: 'hidden',
	clip: 'rect(0, 0, 0, 0)',
	whiteSpace: 'nowrap',
	borderWidth: '0',
};
