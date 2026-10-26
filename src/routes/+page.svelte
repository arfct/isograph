<script lang="ts">
	import { onMount } from 'svelte';
	import Scene from '$lib/scene/Scene.svelte';
	import Toolbar from '$lib/ui/Toolbar.svelte';
	import Inspector from '$lib/ui/Inspector.svelte';
	import CameraBar from '$lib/ui/CameraBar.svelte';
	import BottomBar from '$lib/ui/BottomBar.svelte';
	import HelpPane from '$lib/ui/HelpPane.svelte';
	import Toast from '$lib/ui/Toast.svelte';
	import { doc, loadDoc } from '$lib/state.svelte';
	import { resetHistory, trackHistory } from '$lib/history.svelte';
	import { decodeDoc, encodeDoc } from '$lib/url';

	let lastHash = '';

	trackHistory();

	onMount(() => {
		const read = () => {
			const h = location.hash.slice(1);
			if (h === lastHash) return;
			if (!h) return;
			const d = decodeDoc(h);
			if (d) {
				lastHash = h;
				loadDoc(d);
				resetHistory();
			}
		};
		read();
		window.addEventListener('hashchange', read);
		return () => window.removeEventListener('hashchange', read);
	});

	$effect(() => {
		const enc = encodeDoc(doc);
		const t = setTimeout(() => {
			if (enc === lastHash) return;
			lastHash = enc;
			history.replaceState(null, '', enc ? '#' + enc : location.pathname + location.search);
		}, 200);
		return () => clearTimeout(t);
	});
</script>

<main class="app">
	<Scene />
	<Toolbar />
	<Inspector />
	<CameraBar />
	<BottomBar />
	<HelpPane />
	<Toast />
</main>

<style>
	.app {
		position: fixed;
		inset: 0;
		overflow: hidden;
	}
</style>
