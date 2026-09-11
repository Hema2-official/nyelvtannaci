<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { cn } from '$lib/utils/shadcn';
	import type { LucideIcon } from '@lucide/svelte';

	type Props = {
		href: string;
		Icon: LucideIcon;
		badgeClass?: string;
		label: string;
		description: string;
	};

	let { href, Icon, badgeClass, label, description }: Props = $props();
</script>

<Sidebar.MenuItem>
	<Sidebar.MenuButton size="lg">
		{#snippet child({ props })}
			<a {href} target="_blank" rel="noopener noreferrer" {...props}>
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
			</a>
		{/snippet}
	</Sidebar.MenuButton>
</Sidebar.MenuItem>
