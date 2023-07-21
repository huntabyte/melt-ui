---
title: Pagination
description: An interface that allows navigating between pages that contain split entries.
---

<script>
    import { APIReference, KbdTable } from '$docs/components'
    export let schemas
    export let keyboard
</script>

## Anatomy

- **Root**: The root container for the pagination component
- **Previous Button**: The button which navigates to the previous page
- **Page** Trigger: The button(s) which navigates to a specific page
- **Next** Button: The button which navigates to the next page
- **Range**: The range of pages that are visible to the user

## Usage

To create a pagination component, use the `createPagination` builder function. Follow the anatomy or
the example above to create your pagination component.

```svelte
<script lang="ts">
	import { createPagination } from '@melt-ui/svelte'
	const { prevButton, nextButton, pages, pageTrigger, range, root } = createPagination({
		count: 100,
		perPage: 10,
		page: 1,
		siblingCount: 1
	})
</script>

<nav melt={$root}>
	<p>Showing items {$range.start} - {$range.end}</p>
	<div>
		<button melt={$prevButton}>Prev</button>
		{#each $pages as page (page.key)}
			{#if page.type === 'ellipsis'}
				<span>...</span>
			{:else}
				<button melt={$pageTrigger(page)}>{page.value}</button>
			{/if}
		{/each}
		<button melt={$nextButton}>Next</button>
	</div>
</nav>
```

## API Reference

<APIReference {schemas} />

## Accessibility

Adheres to the
[a11y Accessible Pagination guidelines](https://www.a11ymatters.com/pattern/pagination/)

<KbdTable {keyboard} />
