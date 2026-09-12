<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { ModeWatcher } from 'mode-watcher';

	import '../app.css';

	let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset class="h-dvh w-full items-center">
		<header
			class="flex w-full shrink-0 items-center gap-2 px-3 pt-4 transition-[width] ease-linear md:pt-0"
		>
			<Sidebar.Trigger class="md:hidden" />
		</header>

		{@render children()}
	</Sidebar.Inset>
</Sidebar.Provider>

<Toaster />
<ModeWatcher />
