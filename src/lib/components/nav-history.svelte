<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { RotateCcwClockIcon, SquarePenIcon } from '@lucide/svelte';
	import { historyDb } from '$lib/utils/history.svelte';
	import { viewState } from '$lib/states/ViewState.svelte';

	let open = $state(true);

	const allEntries = historyDb.getAll();
</script>

<Sidebar.Group>
	<Sidebar.Menu>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton onclick={() => viewState.resetSession()}>
				<SquarePenIcon />
				<span>Tiszta lap</span>
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>

		<Collapsible.Root bind:open class="group/collapsible">
			{#snippet child({ props })}
				<Sidebar.MenuItem {...props}>
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<Sidebar.MenuButton {...props} tooltipContent="Előzmények">
								<RotateCcwClockIcon />
								<span>Előzmények</span>
								<ChevronRightIcon
									class="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
								/>
							</Sidebar.MenuButton>
						{/snippet}
					</Collapsible.Trigger>
					<Collapsible.Content>
						<Sidebar.MenuSub>
							{#each allEntries.current as historyEntry (historyEntry.id)}
								{#if historyEntry.id !== undefined}
									{@const id = historyEntry.id}
									<Sidebar.MenuSubItem class="cursor-default">
										<Sidebar.MenuSubButton onclick={() => viewState.openHistory(id)}>
											<span>{historyEntry.query.trim()}</span>
										</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
								{/if}
							{:else}
								<Sidebar.MenuSubItem>
									<span class="text-xs text-muted-foreground italic">
										Még nincsenek előzmények.
									</span>
								</Sidebar.MenuSubItem>
							{/each}
						</Sidebar.MenuSub>
					</Collapsible.Content>
				</Sidebar.MenuItem>
			{/snippet}
		</Collapsible.Root>
	</Sidebar.Menu>
</Sidebar.Group>
