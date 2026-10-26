<script lang="ts">
	import { icons, type IconName } from './icons';

	let { name, size = 16 }: { name: IconName; size?: number } = $props();
</script>

<span class="icon" style:width="{size}px" style:height="{size}px" aria-hidden="true">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static SVG bundled from the heroicons package -->
	{@html icons[name]}
</span>

<style>
	.icon {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
	}
	.icon :global(svg) {
		width: 100%;
		height: 100%;
		stroke-width: 1.75;
	}
</style>
