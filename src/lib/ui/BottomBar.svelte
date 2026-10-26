<script lang="ts">
	import { ui, toggleHelp } from '$lib/state.svelte';
	import Icon from './Icon.svelte';

	const hint = $derived(
		ui.tool === 'shape'
			? `Click the floor to drop a ${ui.shape} · Shift-click to drop more`
			: ui.tool === 'plane'
				? 'Drag on the floor to draw a plane · Hold shift to draw more'
				: ui.tool === 'link'
					? ui.linkFrom == null
						? 'Click the first block'
						: 'Click the second block'
					: 'Drag to pan · Wheel to zoom · Right-drag to rotate'
	);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="panel bottombar" onmousedown={(e) => e.preventDefault()}>
	<button
		class="btn icon"
		class:active={ui.help}
		title="Keyboard shortcuts (?)"
		aria-label="Keyboard shortcuts"
		aria-pressed={ui.help}
		onclick={() => toggleHelp()}
	>
		<Icon name="help" />
	</button>
	<span class="divider"></span>
	<span class="hint">{hint}</span>
</div>

<style>
	.bottombar {
		left: 12px;
		bottom: 12px;
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 4px;
	}
	@media (max-width: 640px) {
		.bottombar {
			left: 8px;
			bottom: 8px;
		}
		.hint,
		.bottombar .divider {
			display: none;
		}
	}
	.hint {
		color: var(--muted);
		font-size: 11px;
		padding: 0 8px 0 4px;
		white-space: nowrap;
	}
</style>
