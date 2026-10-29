<script lang="ts">
	import {
		ui,
		selectionKind,
		selectedBlocks,
		selectedPlanes,
		selectedLinks,
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

	/**
	 * Every control edits all selected items of one kind. A control shows a value only when the
	 * items agree on it; steppers move each item's own value.
	 */
	function same<T, K extends keyof T>(items: T[], key: K): T[K] | undefined {
		const v = items[0]?.[key];
		return items.every((x) => x[key] === v) ? v : undefined;
	}

	function setAll<T, K extends keyof T>(items: T[], key: K, value: T[K]) {
		for (const x of items) x[key] = value;
	}

	function shown(v: number | undefined, digits = 0): string {
		return v === undefined ? '–' : v.toFixed(digits);
	}

	function stepLabel(items: { labelSize: number }[], dir: number) {
		for (const b of items)
			b.labelSize =
				Math.round(
					clamp(b.labelSize + dir * LABEL_SIZE_STEP, MIN_LABEL_SIZE, MAX_LABEL_SIZE) * 10
				) / 10;
	}

	const kind = $derived(selectionKind());
	const blocks = $derived(kind === 'block' ? selectedBlocks() : []);
	const planes = $derived(kind === 'plane' ? selectedPlanes() : []);
	const links = $derived(kind === 'link' ? selectedLinks() : []);
	/** The lone selected link; ends and anchors only make sense for one. */
	const link = $derived(links.length === 1 ? links[0] : undefined);

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

{#snippet title(name: string, items: { id: number }[])}
	{#if items.length === 1}
		<div class="title">{name} <span class="id">#{items[0].id}</span></div>
	{:else}
		<div class="title">{items.length} {name}s</div>
	{/if}
{/snippet}

{#snippet labelFields(items: (Block | Plane | Link)[], id: string)}
	{@const label = same(items, 'label')}
	<div class="field">
		<label class="field-label" for={id}>Label</label>
		<input
			{id}
			type="text"
			placeholder={label === undefined ? 'mixed' : 'untitled'}
			value={label ?? ''}
			oninput={(e) => setAll(items, 'label', e.currentTarget.value)}
		/>
	</div>
{/snippet}

{#snippet labelSizeField(items: { labelSize: number }[])}
	<div class="field">
		<span class="field-label">Label size</span>
		<div class="stepper">
			<button class="btn" onclick={() => stepLabel(items, -1)}
				><Icon name="minus" size={14} /></button
			>
			<span class="value">{shown(same(items, 'labelSize'), 1)}</span>
			<button class="btn" onclick={() => stepLabel(items, 1)}><Icon name="plus" size={14} /></button
			>
		</div>
	</div>
{/snippet}

{#snippet edgeField(items: { edge: Edge }[])}
	<div class="field grow">
		<span class="field-label">Label edge</span>
		<div class="seg">
			{#each EDGES as e (e)}
				<button
					class="btn"
					class:active={same(items, 'edge') === e}
					onclick={() => setAll(items, 'edge', e)}
				>
					{edgeNames[e]}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet swatches(items: { color: number }[])}
	<div class="field">
		<span class="field-label">Color</span>
		<div class="swatches">
			{#each PALETTE as c, i (c.name)}
				<button
					class="swatch"
					class:active={same(items, 'color') === i}
					style:background={c.hex}
					title={c.name}
					aria-label={c.name}
					onclick={() => setAll(items, 'color', i)}
				></button>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet stepper(name: string, value: number | undefined, step: (dir: number) => void)}
	<div class="field">
		<span class="field-label">{name}</span>
		<div class="stepper">
			<button class="btn" onclick={() => step(-1)}><Icon name="minus" size={14} /></button>
			<span class="value">{shown(value)}</span>
			<button class="btn" onclick={() => step(1)}><Icon name="plus" size={14} /></button>
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

{#if kind}
	<div class="panel inspector">
		{#if blocks.length}
			{@render title('Block', blocks)}
			{@render labelFields(blocks, 'block-label')}
			<div class="row">
				{@render edgeField(blocks)}
				{@render labelSizeField(blocks)}
			</div>
			<div class="field">
				<span class="field-label">Shape</span>
				<div class="seg">
					{#each SHAPES as s (s)}
						<button
							class="btn"
							class:active={same(blocks, 'shape') === s}
							title={s}
							aria-label={s}
							onclick={() => setAll(blocks, 'shape', s)}
						>
							<Icon name={s} size={15} />
						</button>
					{/each}
				</div>
			</div>
			<div class="row">
				{@render stepper('Size', same(blocks, 'size'), (dir) => {
					for (const b of blocks) b.size = clamp(b.size + dir, 1, MAX_SIZE);
				})}
				{#if blocks.some((b) => b.shape !== 'sphere')}
					{@render stepper('Height', same(blocks, 'height'), (dir) => {
						for (const b of blocks) b.height = clamp(b.height + dir, 1, MAX_HEIGHT);
					})}
				{/if}
			</div>
			<div class="field">
				<span class="field-label">Shading</span>
				<div class="seg">
					{#each SHADES as s (s)}
						<button
							class="btn"
							class:active={same(blocks, 'shade') === s}
							onclick={() => setAll(blocks, 'shade', s)}
						>
							{s}
						</button>
					{/each}
				</div>
			</div>
			{#if blocks.some((b) => b.shade === 'hatch')}
				<div class="row">
					<div class="field grow">
						<span class="field-label">Hatch</span>
						<div class="seg">
							{#each HATCHES as h (h)}
								<button
									class="btn glyph"
									class:active={same(blocks, 'hatch') === h}
									title={h}
									aria-label={h}
									onclick={() => setAll(blocks, 'hatch', h)}
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
								class:active={same(blocks, 'density') === d}
								onclick={() => setAll(blocks, 'density', d)}
							>
								{d}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{@render swatches(blocks)}
		{:else if planes.length}
			{@render title('Plane', planes)}
			{@render labelFields(planes, 'plane-label')}
			<div class="row">
				{@render edgeField(planes)}
				{@render labelSizeField(planes)}
			</div>
			<div class="row">
				{@render stepper('Width', same(planes, 'w'), (dir) => {
					for (const p of planes) p.w = Math.max(1, p.w + dir);
				})}
				{@render stepper('Depth', same(planes, 'h'), (dir) => {
					for (const p of planes) p.h = Math.max(1, p.h + dir);
				})}
			</div>
			{@render swatches(planes)}
		{:else if links.length}
			{@render title('Link', links)}
			{#if link}
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
			{/if}
			{@render labelFields(links, 'link-label')}
			<div class="row">
				<div class="field grow">
					<span class="field-label">Style</span>
					<div class="seg">
						{#each LINK_STYLES as s (s)}
							<button
								class="btn"
								class:active={same(links, 'style') === s}
								onclick={() => setAll(links, 'style', s)}
							>
								{s}
							</button>
						{/each}
					</div>
				</div>
				{@render labelSizeField(links)}
			</div>
			<div class="row">
				<div class="field grow">
					<span class="field-label">Line</span>
					<div class="seg">
						{#each DASHES as d (d)}
							<button
								class="btn"
								class:active={same(links, 'dash') === d}
								onclick={() => setAll(links, 'dash', d)}
							>
								{d}
							</button>
						{/each}
					</div>
				</div>
				{#if links.some((l) => l.style !== 'straight')}
					<div class="field">
						<span class="field-label">Bend</span>
						<div class="seg">
							<button
								class="btn"
								class:active={same(links, 'bend') === 'x'}
								title="Travel along X first"
								onclick={() => setAll(links, 'bend', 'x')}>X</button
							>
							<button
								class="btn"
								class:active={same(links, 'bend') === 'y'}
								title="Travel along Y first"
								onclick={() => setAll(links, 'bend', 'y')}>Y</button
							>
						</div>
					</div>
				{/if}
			</div>
			{#if link}
				<div class="row">
					{@render anchorPicker(link, 'from', `From ${blockName(link.a)}`)}
					{@render anchorPicker(link, 'to', `To ${blockName(link.b)}`)}
				</div>
			{/if}
			<div class="row">
				<div class="field grow">
					<span class="field-label">Direction</span>
					<div class="seg">
						{#each DIRECTIONS as d (d)}
							<button
								class="btn"
								class:active={same(links, 'direction') === d}
								onclick={() => setAll(links, 'direction', d)}
							>
								{dirNames[d]}
							</button>
						{/each}
					</div>
				</div>
				{#if links.some((l) => l.direction !== 'none')}
					{@const animated = same(links, 'animated')}
					<div class="field">
						<span class="field-label">Flow</span>
						<div class="seg">
							<button
								class="btn"
								class:active={animated === true}
								aria-pressed={animated === true}
								onclick={() => setAll(links, 'animated', animated !== true)}
							>
								{animated === undefined ? 'Mixed' : animated ? 'Animated' : 'Static'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="title">{ui.selection.length} items</div>
			<p class="muted hint">Select items of one kind to edit them together.</p>
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
	.hint {
		margin: 0;
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
