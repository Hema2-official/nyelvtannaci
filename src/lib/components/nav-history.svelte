<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { RotateCcwClockIcon, SquarePenIcon, TrashIcon } from '@lucide/svelte';
	import { historyDb } from '$lib/utils/history.svelte';
	import { viewState } from '$lib/states/ViewState.svelte';
	import { Button } from '$lib/components/ui/button';

	let open = $state(true);

	const allEntries = historyDb.getAll();

	function handleDelete(id: number, e: MouseEvent) {
		e.stopPropagation();
		historyDb.deleteEntry(id);
	}
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
						<Sidebar.MenuSub class="mr-1! pr-1!">
							{#each allEntries.current as historyEntry (historyEntry.id)}
								{#if historyEntry.id !== undefined}
									{@const id = historyEntry.id}
									<Sidebar.MenuSubItem class="cursor-default">
										<Sidebar.MenuSubButton
											onclick={() => viewState.openHistory(id)}
											class="flex justify-between gap-2"
										>
											<span class="truncate">{historyEntry.query.trim()}</span>
											<Button
												variant="ghost"
												size="icon-xs"
												class="hidden group-hover/menu-sub-item:inline-flex hover:bg-destructive/20! hover:text-destructive!"
												onclick={(e) => handleDelete(id, e)}
												><TrashIcon class="size-3.5" />
											</Button>
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
