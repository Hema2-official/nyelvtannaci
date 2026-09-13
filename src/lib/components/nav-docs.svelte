<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { page } from '$app/state';
	import { ArrowLeftIcon } from '@lucide/svelte';
	import { docsGroups } from '$lib/utils/docsSections';

	const sidebar = Sidebar.useSidebar();

	function closeIfMobile() {
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}
</script>

<Sidebar.Group>
	<Sidebar.Menu>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton>
				{#snippet child({ props })}
					<a href="/" {...props}>
						<ArrowLeftIcon />
						<span>Vissza a főoldalra</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	</Sidebar.Menu>
</Sidebar.Group>

{#each docsGroups as { id: groupId, label: groupLabel, sections } (groupId)}
	<Sidebar.Group>
		<Sidebar.GroupLabel>{groupLabel}</Sidebar.GroupLabel>
		<Sidebar.Menu>
			{#each sections as { id, label, Icon } (id)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton isActive={page.url.hash === `#${id}`}>
						{#snippet child({ props })}
							<a href="#{id}" {...props} onclick={closeIfMobile}>
								<Icon />
								<span>{label}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		</Sidebar.Menu>
	</Sidebar.Group>
{/each}
