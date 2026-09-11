<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { HeartIcon, CodeIcon } from '@lucide/svelte';
	import { env } from '$env/dynamic/public';
	import Link from './link.svelte';

	const repoLink = env.PUBLIC_REPO_LINK;
	const donateLink = env.PUBLIC_DONATE_LINK;
</script>

<Sidebar.Menu>
	{#if donateLink}
		<Link
			href={donateLink}
			Icon={HeartIcon}
			badgeClass="bg-rose-600 not-dark:bg-rose-700"
			label="Támogatás"
			description="Minden forint segít"
		/>
	{/if}
	{#if repoLink}
		<Link
			href={repoLink}
			Icon={CodeIcon}
			badgeClass="bg-indigo-600 not-dark:bg-indigo-700"
			label="GitHub"
			description="Forráskód, hibajelentés"
		/>
	{/if}
</Sidebar.Menu>
