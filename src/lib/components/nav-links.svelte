<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { HeartIcon, CodeIcon, BookOpenIcon } from '@lucide/svelte';
	import { env } from '$env/dynamic/public';
	import Link from './link.svelte';
	import Feedback from './feedback.svelte';

	const repoLink = env.PUBLIC_REPO_LINK;
	const donateLink = env.PUBLIC_DONATE_LINK;
</script>

<Sidebar.Menu>
	<Feedback />
	<Link
		href="/docs"
		Icon={BookOpenIcon}
		badgeClass="bg-slate-600 not-dark:bg-slate-700"
		label="Dokumentáció"
		description="Hogyan működik?"
	/>
	{#if donateLink}
		<Link
			href={donateLink}
			Icon={HeartIcon}
			badgeClass="bg-rose-600 not-dark:bg-rose-700"
			label="Támogatás"
			description="Minden forint segít."
		/>
	{/if}
	{#if repoLink}
		<Link
			href={repoLink}
			Icon={CodeIcon}
			badgeClass="bg-blue-600 not-dark:bg-blue-700"
			label="GitHub"
			description="Forráskód, hibajelentés"
		/>
	{/if}
</Sidebar.Menu>
