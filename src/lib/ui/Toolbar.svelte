<script lang="ts">
	import type { Tool } from '$lib/model';
	import { clearDoc, doc, setTool, ui } from '$lib/state.svelte';
	import Icon from './Icon.svelte';

	const tools: { id: Tool; label: string; key: string }[] = [
		{ id: 'select', label: 'Select', key: 'V' },
		{ id: 'block', label: 'Block', key: 'B' },
		{ id: 'plane', label: 'Plane', key: 'P' },
		{ id: 'link', label: 'Link', key: 'L' }
	];

	let copied = $state(false);
	let confirmClear = $state(false);
	const isEmpty = $derived(!doc.blocks.length && !doc.planes.length);

	async function share() {
		try {
			await navigator.clipboard.writeText(location.href);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			prompt('Copy this link', location.href);
		}
	}

	function clear() {
		if (!confirmClear) {
			confirmClear = true;
			setTimeout(() => (confirmClear = false), 2500);
			return;
		}
		clearDoc();
		confirmClear = false;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- biome-ignore lint/a11y/noStaticElementInteractions: mousedown only stops the panel stealing focus from the canvas -->
<div class="panel toolbar" onmousedown={(e) => e.preventDefault()}>
	<span class="brand">ISOGRAPH</span>
	<span class="divider"></span>
	{#each tools as t (t.id)}
		<button type="button" class="btn" class:active={ui.tool === t.id} onclick={() => setTool(t.id)}>
			<Icon name={t.id} /><span class="label">{t.label}</span><span class="key">{t.key}</span>
		</button>
	{/each}
	<span class="divider"></span>
	<button type="button" class="btn" onclick={share}>
		<Icon name={copied ? 'check' : 'share'} />
		<span class="label">{copied ? 'Copied' : 'Share'}</span>
	</button>
	<button type="button" class="btn" class:danger={confirmClear} disabled={isEmpty} onclick={clear}>
		<Icon name="trash" /><span class="label">{confirmClear ? 'Sure?' : 'Clear'}</span>
	</button>
</div>

<style>
	.toolbar {
		top: 12px;
		left: 12px;
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 4px;
	}
	.brand {
		padding: 0 8px 0 6px;
		font-weight: 600;
		letter-spacing: 0.12em;
		font-size: 11px;
	}
	@media (max-width: 640px) {
		.toolbar {
			left: 8px;
			top: 8px;
			right: 8px;
			justify-content: space-between;
			gap: 0;
		}
		.brand,
		.label,
		.toolbar :global(.key) {
			display: none;
		}
		.toolbar :global(.btn) {
			padding: 0;
			width: 34px;
			height: 32px;
			justify-content: center;
		}
	}
	.danger {
		background: var(--ink);
		color: var(--bg);
	}
</style>
