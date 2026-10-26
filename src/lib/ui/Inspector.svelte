<script lang="ts">
	import {
		clamp,
		EDGES,
		LABEL_SIZE_STEP,
		MAX_HEIGHT,
		MAX_LABEL_SIZE,
		MAX_SIZE,
		MIN_LABEL_SIZE,
		PALETTE,
		SHADES,
		type Shade
	} from '$lib/model';
	import {
		blockById,
		deleteSelection,
		selectedBlock,
		selectedLink,
		selectedPlane
	} from '$lib/state.svelte';
	import Icon from './Icon.svelte';

	function stepLabel(b: { labelSize: number }, dir: number) {
		b.labelSize =
			Math.round(clamp(b.labelSize + dir * LABEL_SIZE_STEP, MIN_LABEL_SIZE, MAX_LABEL_SIZE) * 10) /
			10;
	}

	const block = $derived(selectedBlock());
	const plane = $derived(selectedPlane());
	const link = $derived(selectedLink());

	const edgeNames: Record<string, string> = { S: 'Front', E: 'Right', N: 'Back', W: 'Left' };
</script>

{#if block || plane || link}
	<div class="panel inspector">
		{#if block}
			<div class="title">Block <span class="id">#{block.id}</span></div>
			<div class="field">
				<label class="field-label" for="label">Label</label>
				<input
					id="label"
					type="text"
					placeholder="untitled"
					value={block.label}
					oninput={(e) => (block.label = e.currentTarget.value)}
				/>
			</div>
			<div class="row">
				<div class="field grow">
					<span class="field-label">Label edge</span>
					<div class="seg">
						{#each EDGES as e (e)}
							<button
								type="button"
								class="btn"
								class:active={block.edge === e}
								onclick={() => (block.edge = e)}
							>
								{edgeNames[e]}
							</button>
						{/each}
					</div>
				</div>
				<div class="field">
					<span class="field-label">Label size</span>
					<div class="stepper">
						<button type="button" class="btn" onclick={() => stepLabel(block, -1)}>
							<Icon name="minus" size={14} />
						</button>
						<span class="value">{block.labelSize.toFixed(1)}</span>
						<button type="button" class="btn" onclick={() => stepLabel(block, 1)}>
							<Icon name="plus" size={14} />
						</button>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="field">
					<span class="field-label">Size</span>
					<div class="stepper">
						<button
							type="button"
							class="btn"
							onclick={() => (block.size = clamp(block.size - 1, 1, MAX_SIZE))}
						>
							<Icon name="minus" size={14} />
						</button>
						<span class="value">{block.size}</span>
						<button
							type="button"
							class="btn"
							onclick={() => (block.size = clamp(block.size + 1, 1, MAX_SIZE))}
						>
							<Icon name="plus" size={14} />
						</button>
					</div>
				</div>
				<div class="field">
					<span class="field-label">Height</span>
					<div class="stepper">
						<button
							type="button"
							class="btn"
							onclick={() => (block.height = clamp(block.height - 1, 1, MAX_HEIGHT))}
						>
							<Icon name="minus" size={14} />
						</button>
						<span class="value">{block.height}</span>
						<button
							type="button"
							class="btn"
							onclick={() => (block.height = clamp(block.height + 1, 1, MAX_HEIGHT))}
						>
							<Icon name="plus" size={14} />
						</button>
					</div>
				</div>
			</div>
			<div class="field">
				<span class="field-label">Shading</span>
				<div class="seg">
					{#each SHADES as s (s)}
						<button
							type="button"
							class="btn"
							class:active={block.shade === s}
							onclick={() => (block.shade = s as Shade)}
						>
							{s}
						</button>
					{/each}
				</div>
			</div>
			<div class="field">
				<span class="field-label">Color</span>
				<div class="swatches">
					{#each PALETTE as c, i (c.name)}
						<button
							type="button"
							class="swatch"
							class:active={block.color === i}
							style:background={c.hex}
							title={c.name}
							aria-label={c.name}
							onclick={() => (block.color = i)}
						></button>
					{/each}
				</div>
			</div>
		{:else if plane}
			<div class="title">Plane <span class="id">#{plane.id}</span></div>
			<div class="row">
				<div class="field">
					<span class="field-label">Width</span>
					<div class="stepper">
						<button type="button" class="btn" onclick={() => (plane.w = Math.max(1, plane.w - 1))}>
							<Icon name="minus" size={14} />
						</button>
						<span class="value">{plane.w}</span>
						<button type="button" class="btn" onclick={() => (plane.w = plane.w + 1)}>
							<Icon name="plus" size={14} />
						</button>
					</div>
				</div>
				<div class="field">
					<span class="field-label">Depth</span>
					<div class="stepper">
						<button type="button" class="btn" onclick={() => (plane.h = Math.max(1, plane.h - 1))}>
							<Icon name="minus" size={14} />
						</button>
						<span class="value">{plane.h}</span>
						<button type="button" class="btn" onclick={() => (plane.h = plane.h + 1)}>
							<Icon name="plus" size={14} />
						</button>
					</div>
				</div>
			</div>
			<div class="field">
				<span class="field-label">Color</span>
				<div class="swatches">
					{#each PALETTE as c, i (c.name)}
						<button
							type="button"
							class="swatch"
							class:active={plane.color === i}
							style:background={c.hex}
							title={c.name}
							aria-label={c.name}
							onclick={() => (plane.color = i)}
						></button>
					{/each}
				</div>
			</div>
		{:else if link}
			<div class="title">Link <span class="id">#{link.id}</span></div>
			<div class="field">
				<span class="field-label">Connects</span>
				<div class="muted">
					{blockById(link.a)?.label || `Block #${link.a}`}
					→ {blockById(link.b)?.label || `Block #${link.b}`}
				</div>
			</div>
		{/if}
		<div class="footer">
			<button type="button" class="btn delete" onclick={deleteSelection}>
				<Icon name="trash" />Delete <span class="key">⌫</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.inspector {
		top: 12px;
		right: 12px;
		width: 280px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 12px;
	}
	@media (max-width: 640px) {
		.inspector {
			top: auto;
			left: 8px;
			right: 8px;
			bottom: 52px;
			width: auto;
			max-height: calc(100dvh - 120px);
			overflow-y: auto;
		}
	}
	.title {
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 11px;
	}
	.id {
		color: var(--muted);
		font-weight: 400;
	}
	.row {
		display: flex;
		gap: 12px;
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.muted {
		color: var(--muted);
	}
	.footer {
		border-top: 1px solid var(--line);
		padding-top: 10px;
		display: flex;
		justify-content: flex-end;
	}
	.delete {
		border-color: var(--line);
	}
	.delete:hover {
		background: var(--ink);
		color: var(--bg);
	}
</style>
