<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { RotateCcwClockIcon, SquarePenIcon, TrashIcon } from '@lucide/svelte';
	import { historyDb } from '$lib/utils/history.svelte';
	import { viewState } from '$lib/states/ViewState.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { track } from '$lib/api/analytics';

	let open = $state(true);

	const sidebar = Sidebar.useSidebar();

	const allEntries = historyDb.getAll();

	function handleOpen(id: number) {
		track({ kind: 'history_open' });
		viewState.openHistory(id);
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}

	function handleResetSession() {
		viewState.resetSession();
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}

	function handleDelete(id: number, e: MouseEvent) {
		e.stopPropagation();
		track({ kind: 'history_delete' });
		historyDb.deleteEntry(id);
	}
</script>

<Sidebar.Group>
	<Sidebar.Menu>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton onclick={handleResetSession}>
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
							{#if allEntries.current === undefined}
								<Sidebar.MenuSubItem class="flex justify-center py-1.5">
									<Spinner class="text-muted-foreground" />
								</Sidebar.MenuSubItem>
							{:else}
								{#each allEntries.current as historyEntry (historyEntry.id)}
									{#if historyEntry.id !== undefined}
										{@const id = historyEntry.id}
										<Sidebar.MenuSubItem class="cursor-default">
											<Sidebar.MenuSubButton
												onclick={() => handleOpen(id)}
												class="flex justify-between gap-2 pr-0.5!"
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
							{/if}
						</Sidebar.MenuSub>
					</Collapsible.Content>
				</Sidebar.MenuItem>
			{/snippet}
		</Collapsible.Root>
	</Sidebar.Menu>
</Sidebar.Group>
