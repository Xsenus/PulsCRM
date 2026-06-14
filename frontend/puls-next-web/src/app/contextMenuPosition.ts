export interface ContextMenuPositionInput {
  clientX: number;
  clientY: number;
  viewportWidth: number;
  viewportHeight: number;
  menuWidth?: number;
  menuHeight?: number;
  viewportGap?: number;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

const DEFAULT_MENU_WIDTH = 220;
const DEFAULT_MENU_HEIGHT = 260;
const DEFAULT_VIEWPORT_GAP = 8;

export function getContextMenuPosition({
  clientX,
  clientY,
  viewportWidth,
  viewportHeight,
  menuWidth = DEFAULT_MENU_WIDTH,
  menuHeight = DEFAULT_MENU_HEIGHT,
  viewportGap = DEFAULT_VIEWPORT_GAP
}: ContextMenuPositionInput): ContextMenuPosition {
  const maxX = Math.max(viewportGap, viewportWidth - menuWidth - viewportGap);
  const maxY = Math.max(viewportGap, viewportHeight - menuHeight - viewportGap);

  return {
    x: Math.min(Math.max(viewportGap, clientX), maxX),
    y: Math.min(Math.max(viewportGap, clientY), maxY)
  };
}
