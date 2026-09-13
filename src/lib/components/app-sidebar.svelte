<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import type { ComponentProps } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import NavHistory from './nav-history.svelte';
	import NavDocs from './nav-docs.svelte';
	import NavLinks from './nav-links.svelte';
	import { BookOpenCheckIcon } from '@lucide/svelte';

	let { ref = $bindable(null) }: ComponentProps<typeof Sidebar.Root> = $props();

	const sidebar = Sidebar.useSidebar();
	const inDocs = $derived(page.url.pathname.startsWith('/docs'));

	afterNavigate(() => {
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	});
</script>

<Sidebar.Root bind:ref variant="floating">
	<Sidebar.Header>
		<span class="flex items-center justify-center gap-2 pt-2 text-center text-base font-semibold">
			<BookOpenCheckIcon class="size-6" />
			<h1>Helyesírás-ellenőrző</h1>
		</span>
	</Sidebar.Header>
	<Sidebar.Content>
		{#if inDocs}
			<NavDocs />
		{:else}
			<NavHistory />
		{/if}
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavLinks />
	</Sidebar.Footer>
</Sidebar.Root>
