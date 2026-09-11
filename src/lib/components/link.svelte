<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { cn } from '$lib/utils/shadcn';
	import type { LucideIcon } from '@lucide/svelte';
	import type { MouseEventHandler } from 'svelte/elements';

	type Props = {
		Icon: LucideIcon;
		badgeClass?: string;
		label: string;
		description: string;
	};

	type ButtonProps = Props & { onclick: MouseEventHandler<HTMLButtonElement>; href?: never };
	type LinkProps = Props & { href: string; onclick?: never };

	let { onclick, href, Icon, badgeClass, label, description }: ButtonProps | LinkProps = $props();
</script>

{#snippet Contents()}
	<div
		class={cn(
			'flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground',
			badgeClass
		)}
	>
		<Icon class="size-4" />
	</div>
	<div class="flex flex-col gap-0.5 leading-none">
		<span class="font-medium">{label}</span>
		<span class="opacity-85">{description}</span>
	</div>
{/snippet}

<Sidebar.MenuItem>
	<Sidebar.MenuButton size="lg">
		{#snippet child({ props })}
			{#if href}
				<a {href} target="_blank" rel="noopener noreferrer" {...props}>{@render Contents()}</a>
			{:else if onclick}
				<button {onclick} {...props}>{@render Contents()}</button>
			{/if}
		{/snippet}
	</Sidebar.MenuButton>
</Sidebar.MenuItem>
