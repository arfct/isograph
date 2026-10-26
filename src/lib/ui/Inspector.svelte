<script lang="ts">
	import {
		selectedBlock,
		selectedPlane,
		selectedLink,
		blockById,
		deleteSelection,
		swapLink
	} from '$lib/state.svelte';
	import {
		DASHES,
		DENSITIES,
		DIRECTIONS,
		EDGES,
		HATCHES,
		LABEL_SIZE_STEP,
		LINK_STYLES,
		MAX_HEIGHT,
		MAX_LABEL_SIZE,
		MAX_SIZE,
		MIN_LABEL_SIZE,
		PALETTE,
		SHADES,
		SHAPES,
		clamp,
		type Anchor,
		type Block,
		type Edge,
		type Link,
		type Plane
	} from '$lib/model';
	import Icon from './Icon.svelte';

	function stepLabel(b: { labelSize: number }, dir: number) {
		b.labelSize =
			Math.round(clamp(b.labelSize + dir * LABEL_SIZE_STEP, MIN_LABEL_SIZE, MAX_LABEL_SIZE) * 10) /
			10;
	}

	const block = $derived(selectedBlock());
	const plane = $derived(selectedPlane());
	const link = $derived(selectedLink());

	const edgeNames: Record<Edge, string> = { S: 'Front', E: 'Right', N: 'Back', W: 'Left' };
	const hatchGlyphs: Record<Block['hatch'], string> = {
		diagonal: '/',
		backslash: '\\',
		cross: 'X',
		horizontal: '=',
		vertical: '||',
		grid: '#'
	};
	const dirNames: Record<Link['direction'], string> = {
		none: 'None',
		forward: 'One-way',
		both: 'Two-way'
	};
	/** Anchor picker rows, laid out as seen from above with north at the top. */
	const anchorRows: Anchor[][] = [
		['NW', 'N', 'NE'],
		['W', 'C', 'E'],
		['SW', 'S', 'SE']
	];
	const anchorNames: Record<Anchor, string> = {
		C: 'Centre',
		N: 'Back edge',
		E: 'Right edge',
		S: 'Front edge',
		W: 'Left edge',
		NE: 'Back-right corner',
		SE: 'Front-right corner',
		SW: 'Front-left corner',
		NW: 'Back-left corner'
	};

	function blockName(id: number) {
		return blockById(id)?.label || `Block #${id}`;
	}
</script>

{#snippet labelFields(target: Block | Plane | Link, id: string)}
	<div class="field">
		<label class="field-label" for={id}>Label</label>
		<input
			{id}
			type="text"
			placeholder="untitled"
			value={target.label}
			oninput={(e) => (target.label = e.currentTarget.value)}
		/>
	</div>
{/snippet}

{#snippet labelSizeField(target: { labelSize: number })}
	<div class="field">
		<span class="field-label">Label size</span>
		<div class="stepper">
			<button class="btn" onclick={() => stepLabel(target, -1)}
				><Icon name="minus" size={14} /></button
			>
			<span class="value">{target.labelSize.toFixed(1)}</span>
			<button class="btn" onclick={() => stepLabel(target, 1)}
				><Icon name="plus" size={14} /></button
			>
		</div>
	</div>
{/snippet}

{#snippet edgeField(target: { edge: Edge })}
	<div class="field grow">
		<span class="field-label">Label edge</span>
		<div class="seg">
			{#each EDGES as e (e)}
				<button class="btn" class:active={target.edge === e} onclick={() => (target.edge = e)}>
					{edgeNames[e]}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet swatches(target: { color: number })}
	<div class="field">
		<span class="field-label">Color</span>
		<div class="swatches">
			{#each PALETTE as c, i (c.name)}
				<button
					class="swatch"
					class:active={target.color === i}
					style:background={c.hex}
					title={c.name}
					aria-label={c.name}
					onclick={() => (target.color = i)}
				></button>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet anchorPicker(l: Link, end: 'from' | 'to', title: string)}
	<div class="field">
		<span class="field-label">{title}</span>
		<div class="anchors" role="group" aria-label={title}>
			{#each anchorRows as row, r (r)}
				{#each row as a (a)}
					<button
						class="anchor"
						class:active={l[end] === a}
						title={anchorNames[a]}
						aria-label={anchorNames[a]}
						aria-pressed={l[end] === a}
						onclick={() => (l[end] = a)}
					></button>
				{/each}
			{/each}
		</div>
	</div>
{/snippet}

{#if block || plane || link}
	<div class="panel inspector">
		{#if block}
			<div class="title">Block <span class="id">#{block.id}</span></div>
			{@render labelFields(block, 'block-label')}
			<div class="row">
				{@render edgeField(block)}
				{@render labelSizeField(block)}
			</div>
			<div class="field">
				<span class="field-label">Shape</span>
				<div class="seg">
					{#each SHAPES as s (s)}
						<button
							class="btn"
							class:active={block.shape === s}
							title={s}
							aria-label={s}
							onclick={() => (block.shape = s)}
						>
							<Icon name={s} size={15} />
						</button>
					{/each}
				</div>
			</div>
			<div class="row">
				<div class="field">
					<span class="field-label">Size</span>
					<div class="stepper">
						<button class="btn" onclick={() => (block.size = clamp(block.size - 1, 1, MAX_SIZE))}
							><Icon name="minus" size={14} /></button
						>
						<span class="value">{block.size}</span>
						<button class="btn" onclick={() => (block.size = clamp(block.size + 1, 1, MAX_SIZE))}
							><Icon name="plus" size={14} /></button
						>
					</div>
				</div>
				{#if block.shape !== 'sphere'}
					<div class="field">
						<span class="field-label">Height</span>
						<div class="stepper">
							<button
								class="btn"
								onclick={() => (block.height = clamp(block.height - 1, 1, MAX_HEIGHT))}
								><Icon name="minus" size={14} /></button
							>
							<span class="value">{block.height}</span>
							<button
								class="btn"
								onclick={() => (block.height = clamp(block.height + 1, 1, MAX_HEIGHT))}
								><Icon name="plus" size={14} /></button
							>
						</div>
					</div>
				{/if}
			</div>
			<div class="field">
				<span class="field-label">Shading</span>
				<div class="seg">
					{#each SHADES as s (s)}
						<button class="btn" class:active={block.shade === s} onclick={() => (block.shade = s)}>
							{s}
						</button>
					{/each}
				</div>
			</div>
			{#if block.shade === 'hatch'}
				<div class="row">
					<div class="field grow">
						<span class="field-label">Hatch</span>
						<div class="seg">
							{#each HATCHES as h (h)}
								<button
									class="btn glyph"
									class:active={block.hatch === h}
									title={h}
									aria-label={h}
									onclick={() => (block.hatch = h)}
								>
									{hatchGlyphs[h]}
								</button>
							{/each}
						</div>
					</div>
				</div>
				<div class="field">
					<span class="field-label">Density</span>
					<div class="seg">
						{#each DENSITIES as d (d)}
							<button
								class="btn"
								class:active={block.density === d}
								onclick={() => (block.density = d)}
							>
								{d}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{@render swatches(block)}
		{:else if plane}
			<div class="title">Plane <span class="id">#{plane.id}</span></div>
			{@render labelFields(plane, 'plane-label')}
			<div class="row">
				{@render edgeField(plane)}
				{@render labelSizeField(plane)}
			</div>
			<div class="row">
				<div class="field">
					<span class="field-label">Width</span>
					<div class="stepper">
						<button class="btn" onclick={() => (plane.w = Math.max(1, plane.w - 1))}
							><Icon name="minus" size={14} /></button
						>
						<span class="value">{plane.w}</span>
						<button class="btn" onclick={() => (plane.w = plane.w + 1)}
							><Icon name="plus" size={14} /></button
						>
					</div>
				</div>
				<div class="field">
					<span class="field-label">Depth</span>
					<div class="stepper">
						<button class="btn" onclick={() => (plane.h = Math.max(1, plane.h - 1))}
							><Icon name="minus" size={14} /></button
						>
						<span class="value">{plane.h}</span>
						<button class="btn" onclick={() => (plane.h = plane.h + 1)}
							><Icon name="plus" size={14} /></button
						>
					</div>
				</div>
			</div>
			{@render swatches(plane)}
		{:else if link}
			<div class="title">Link <span class="id">#{link.id}</span></div>
			<div class="field">
				<span class="field-label">Connects</span>
				<div class="connects">
					<span class="muted ends">{blockName(link.a)} → {blockName(link.b)}</span>
					<button
						class="btn icon"
						title="Swap ends"
						aria-label="Swap ends"
						onclick={() => swapLink(link)}><Icon name="swap" /></button
					>
				</div>
			</div>
			{@render labelFields(link, 'link-label')}
			<div class="row">
				<div class="field grow">
					<span class="field-label">Style</span>
					<div class="seg">
						{#each LINK_STYLES as s (s)}
							<button class="btn" class:active={link.style === s} onclick={() => (link.style = s)}>
								{s}
							</button>
						{/each}
					</div>
				</div>
				{@render labelSizeField(link)}
			</div>
			<div class="row">
				<div class="field grow">
					<span class="field-label">Line</span>
					<div class="seg">
						{#each DASHES as d (d)}
							<button class="btn" class:active={link.dash === d} onclick={() => (link.dash = d)}>
								{d}
							</button>
						{/each}
					</div>
				</div>
				{#if link.style !== 'straight'}
					<div class="field">
						<span class="field-label">Bend</span>
						<div class="seg">
							<button
								class="btn"
								class:active={link.bend === 'x'}
								title="Travel along X first"
								onclick={() => (link.bend = 'x')}>X</button
							>
							<button
								class="btn"
								class:active={link.bend === 'y'}
								title="Travel along Y first"
								onclick={() => (link.bend = 'y')}>Y</button
							>
						</div>
					</div>
				{/if}
			</div>
			<div class="row">
				{@render anchorPicker(link, 'from', `From ${blockName(link.a)}`)}
				{@render anchorPicker(link, 'to', `To ${blockName(link.b)}`)}
			</div>
			<div class="row">
				<div class="field grow">
					<span class="field-label">Direction</span>
					<div class="seg">
						{#each DIRECTIONS as d (d)}
							<button
								class="btn"
								class:active={link.direction === d}
								onclick={() => (link.direction = d)}
							>
								{dirNames[d]}
							</button>
						{/each}
					</div>
				</div>
				{#if link.direction !== 'none'}
					<div class="field">
						<span class="field-label">Flow</span>
						<div class="seg">
							<button
								class="btn"
								class:active={link.animated}
								aria-pressed={link.animated}
								onclick={() => (link.animated = !link.animated)}
							>
								{link.animated ? 'Animated' : 'Static'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
		<div class="footer">
			<button class="btn delete" onclick={deleteSelection}
				><Icon name="trash" />Delete <span class="key">⌫</span></button
			>
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
		max-height: calc(100dvh - 24px);
		overflow-y: auto;
	}
	@media (max-width: 640px) {
		.inspector {
			top: auto;
			left: 8px;
			right: 8px;
			bottom: 52px;
			width: auto;
			max-height: calc(100dvh - 120px);
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
	.glyph {
		text-transform: none;
		font-weight: 600;
	}
	.connects {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.ends {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.anchors {
		display: grid;
		grid-template-columns: repeat(3, 20px);
		gap: 3px;
		padding: 4px;
		border: 1px solid var(--line);
		border-radius: 4px;
		width: max-content;
	}
	.anchor {
		width: 20px;
		height: 20px;
		padding: 0;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: #fff;
		cursor: pointer;
	}
	.anchor:hover {
		background: rgba(21, 21, 21, 0.06);
	}
	.anchor.active {
		background: var(--ink);
		border-color: var(--ink);
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
