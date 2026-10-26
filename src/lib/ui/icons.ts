// Heroicons (24px outline) — https://heroicons.com

import arrowPath from 'heroicons/24/outline/arrow-path.svg?raw';
import arrowUturnLeft from 'heroicons/24/outline/arrow-uturn-left.svg?raw';
import arrowUturnRight from 'heroicons/24/outline/arrow-uturn-right.svg?raw';
import check from 'heroicons/24/outline/check.svg?raw';
import chevronDown from 'heroicons/24/outline/chevron-down.svg?raw';
import chevronUp from 'heroicons/24/outline/chevron-up.svg?raw';
import cube from 'heroicons/24/outline/cube.svg?raw';
import cursorArrowRays from 'heroicons/24/outline/cursor-arrow-rays.svg?raw';
import link from 'heroicons/24/outline/link.svg?raw';
import magnifyingGlassMinus from 'heroicons/24/outline/magnifying-glass-minus.svg?raw';
import magnifyingGlassPlus from 'heroicons/24/outline/magnifying-glass-plus.svg?raw';
import minus from 'heroicons/24/outline/minus.svg?raw';
import plus from 'heroicons/24/outline/plus.svg?raw';
import questionMarkCircle from 'heroicons/24/outline/question-mark-circle.svg?raw';
import share from 'heroicons/24/outline/share.svg?raw';
import stop from 'heroicons/24/outline/stop.svg?raw';
import trash from 'heroicons/24/outline/trash.svg?raw';
import xMark from 'heroicons/24/outline/x-mark.svg?raw';

export const icons = {
	select: cursorArrowRays,
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
	close: xMark
} as const;

export type IconName = keyof typeof icons;
