import { describe, expect, it } from 'vitest';
import { getContextMenuPosition } from './contextMenuPosition';

describe('getContextMenuPosition', () => {
  it('keeps context menu inside right and bottom viewport edges', () => {
    expect(getContextMenuPosition({
      clientX: 780,
      clientY: 560,
      viewportWidth: 800,
      viewportHeight: 600,
      menuWidth: 220,
      menuHeight: 260,
      viewportGap: 8
    })).toEqual({ x: 572, y: 332 });
  });

  it('keeps context menu away from left and top viewport edges', () => {
    expect(getContextMenuPosition({
      clientX: -12,
      clientY: 2,
      viewportWidth: 800,
      viewportHeight: 600,
      menuWidth: 220,
      menuHeight: 260,
      viewportGap: 8
    })).toEqual({ x: 8, y: 8 });
  });

  it('uses the viewport gap when the menu is wider than the viewport', () => {
    expect(getContextMenuPosition({
      clientX: 160,
      clientY: 120,
      viewportWidth: 180,
      viewportHeight: 160,
      menuWidth: 220,
      menuHeight: 260,
      viewportGap: 8
    })).toEqual({ x: 8, y: 8 });
  });
});
