// Heroicons (24px outline) — https://heroicons.com
import cursorArrowRays from 'heroicons/24/outline/cursor-arrow-rays.svg?raw';
import cube from 'heroicons/24/outline/cube.svg?raw';
import stop from 'heroicons/24/outline/stop.svg?raw';
import link from 'heroicons/24/outline/link.svg?raw';
import share from 'heroicons/24/outline/share.svg?raw';
import trash from 'heroicons/24/outline/trash.svg?raw';
import check from 'heroicons/24/outline/check.svg?raw';
import arrowUturnLeft from 'heroicons/24/outline/arrow-uturn-left.svg?raw';
import arrowUturnRight from 'heroicons/24/outline/arrow-uturn-right.svg?raw';
import chevronDown from 'heroicons/24/outline/chevron-down.svg?raw';
import chevronUp from 'heroicons/24/outline/chevron-up.svg?raw';
import magnifyingGlassMinus from 'heroicons/24/outline/magnifying-glass-minus.svg?raw';
import magnifyingGlassPlus from 'heroicons/24/outline/magnifying-glass-plus.svg?raw';
import arrowPath from 'heroicons/24/outline/arrow-path.svg?raw';
import plus from 'heroicons/24/outline/plus.svg?raw';
import minus from 'heroicons/24/outline/minus.svg?raw';
import questionMarkCircle from 'heroicons/24/outline/question-mark-circle.svg?raw';
import xMark from 'heroicons/24/outline/x-mark.svg?raw';
import arrowsRightLeft from 'heroicons/24/outline/arrows-right-left.svg?raw';

// Shape glyphs drawn in the same 24px outline style as the Heroicons above.
const svg = (body: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">${body}</svg>`;
const cylinder = svg(
	'<path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />'
);
const sphere = svg(
	'<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-4.5 0c0 4.97-2.015 9-4.5 9s-4.5-4.03-4.5-9 2.015-9 4.5-9 4.5 4.03 4.5 9ZM3.75 9h16.5M3.75 15h16.5" />'
);
const pyramid = svg(
	'<path stroke-linecap="round" stroke-linejoin="round" d="M12 3 2.25 16.5 12 21l9.75-4.5L12 3Zm0 0v18" />'
);

export const icons = {
	select: cursorArrowRays,
	shape: cube,
	block: cube,
	plane: stop,
	link,
	share,
	trash,
	check,
	'rotate-left': arrowUturnLeft,
	'rotate-right': arrowUturnRight,
	'chevron-down': chevronDown,
	'chevron-up': chevronUp,
	'zoom-out': magnifyingGlassMinus,
	'zoom-in': magnifyingGlassPlus,
	reset: arrowPath,
	plus,
	minus,
	help: questionMarkCircle,
	close: xMark,
	swap: arrowsRightLeft,
	box: cube,
	cylinder,
	sphere,
	pyramid
} as const;

export type IconName = keyof typeof icons;
