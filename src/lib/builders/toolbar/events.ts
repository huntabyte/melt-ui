import type { GroupedEvents, MeltComponentEvents } from '$lib/internal/types.js';

export const toolbarEvents = {
	button: ['keydown'] as const,
	link: ['keydown'] as const,
	item: ['click', 'keydown'] as const,
};

export type ToolbarEvents = GroupedEvents<typeof toolbarEvents>;
export type ToolbarComponentEvents = MeltComponentEvents<ToolbarEvents>;
