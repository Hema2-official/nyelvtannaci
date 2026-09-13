<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { cn } from '$lib/utils/shadcn';
	import type { LucideIcon } from '@lucide/svelte';

	type Props = {
		Icon: LucideIcon;
		badgeClass?: string;
		label: string;
		description: string;
	};

	type ButtonProps = Props & { onclick: () => void; href?: never };
	type LinkProps = Props & { href: string; onclick?: never };

	let { onclick, href, Icon, badgeClass, label, description }: ButtonProps | LinkProps = $props();

	const sidebar = Sidebar.useSidebar();

	const isExternal = $derived(href !== undefined && /^[a-z]+:\/\//i.test(href));

	function closeIfMobile() {
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}
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
				<a
					{...props}
					{href}
					target={isExternal ? '_blank' : undefined}
					rel={isExternal ? 'noopener noreferrer' : undefined}
					onclick={closeIfMobile}
					>{@render Contents()}
				</a>
			{:else if onclick}
				<button {...props} {onclick}>{@render Contents()}</button>
			{/if}
		{/snippet}
	</Sidebar.MenuButton>
</Sidebar.MenuItem>
