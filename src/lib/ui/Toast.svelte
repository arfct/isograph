<script lang="ts">
	import { ui } from '$lib/state.svelte';
</script>

{#if ui.toast}
	{#key ui.toast.id}
		<div class="toast" role="status" aria-live="polite">{ui.toast.text}</div>
	{/key}
{/if}

<style>
	.toast {
		position: absolute;
		left: 50%;
		bottom: 20px;
		transform: translateX(-50%);
		padding: 6px 12px;
		border-radius: 6px;
		background: var(--ink);
		color: var(--bg);
		font-size: 11px;
		letter-spacing: 0.04em;
		white-space: nowrap;
		pointer-events: none;
		animation: toast-in 160ms ease-out;
	}
	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translate(-50%, 6px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}
	@media (max-width: 640px) {
		.toast {
			bottom: 52px;
		}
	}
</style>
