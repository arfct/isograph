<script lang="ts">
	import { toggleHelp, ui } from '$lib/state.svelte';
	import Icon from './Icon.svelte';

	type Row = { keys: string[]; label: string };
	type Group = { title: string; rows: Row[] };

	const groups: Group[] = [
		{
			title: 'Tools',
			rows: [
				{ keys: ['V'], label: 'Select' },
				{ keys: ['B'], label: 'Block' },
				{ keys: ['P'], label: 'Plane' },
				{ keys: ['L'], label: 'Link' },
				{ keys: ['Esc'], label: 'Back to select / deselect' }
			]
		},
		{
			title: 'Camera',
			rows: [
				{ keys: ['Drag'], label: 'Pan the floor' },
				{ keys: ['Space', 'Drag'], label: 'Pan from anywhere' },
				{ keys: ['Wheel'], label: 'Zoom' },
				{ keys: ['+', '−'], label: 'Zoom in / out' },
				{ keys: ['Right-drag'], label: 'Rotate' },
				{ keys: ['Q', 'E'], label: 'Rotate left / right' }
			]
		},
		{
			title: 'Selection',
			rows: [
				{ keys: ['↑', '↓', '←', '→'], label: 'Nudge one cell' },
				{ keys: ['Drag corner'], label: 'Resize' },
				{ keys: ['Drag pyramid'], label: 'Set block height' },
				{ keys: ['⌫'], label: 'Delete' }
			]
		},
		{
			title: 'Help',
			rows: [{ keys: ['?'], label: 'Toggle this pane' }]
		}
	];
</script>

{#if ui.help}
	<div class="panel help" role="dialog" aria-label="Keyboard shortcuts" tabindex="-1">
		<div class="head">
			<span class="title">Keyboard shortcuts</span>
			<button
				type="button"
				class="btn icon"
				title="Close (Esc)"
				aria-label="Close"
				onclick={() => toggleHelp(false)}
			>
				<Icon name="close" />
			</button>
		</div>
		<div class="groups">
			{#each groups as g (g.title)}
				<div class="group">
					<div class="field-label">{g.title}</div>
					{#each g.rows as r (r.label)}
						<div class="row">
							<span class="keys">
								{#each r.keys as k, i (k)}
									{#if i > 0}
										<span class="sep">·</span>
									{/if}
									<kbd>{k}</kbd>
								{/each}
							</span>
							<span class="label">{r.label}</span>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.help {
		left: 12px;
		bottom: 52px;
		width: 320px;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
	}
	@media (max-width: 640px) {
		.help {
			left: 8px;
			right: 8px;
			bottom: 52px;
			width: auto;
			max-height: calc(100dvh - 120px);
			overflow-y: auto;
		}
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.title {
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 11px;
	}
	.groups {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.group .field-label {
		margin-bottom: 2px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.keys {
		flex: none;
		min-width: 120px;
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.sep {
		color: var(--muted);
	}
	kbd {
		display: inline-block;
		font: inherit;
		font-size: 10px;
		line-height: 18px;
		padding: 0 6px;
		border: 1px solid var(--line-strong);
		border-bottom-width: 2px;
		border-radius: 4px;
		background: #fff;
		white-space: nowrap;
	}
	.label {
		color: var(--muted);
	}
</style>
