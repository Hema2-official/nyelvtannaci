<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import type { ComponentProps } from 'svelte';
	import NavHistory from './nav-history.svelte';
	import NavLinks from './nav-links.svelte';

	let { ref = $bindable(null) }: ComponentProps<typeof Sidebar.Root> = $props();
</script>

<Sidebar.Root bind:ref variant="floating">
	<Sidebar.Header></Sidebar.Header>
	<Sidebar.Content>
		<NavHistory />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavLinks />
	</Sidebar.Footer>
</Sidebar.Root>
