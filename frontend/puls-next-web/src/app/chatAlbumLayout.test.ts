import { describe, expect, it } from 'vitest';
import { albumRatio, computeAlbumLayout } from './chatAlbumLayout';

function check(ratios: number[]) {
  const layout = computeAlbumLayout(ratios);
  expect(layout.tiles.map((tile) => tile.index)).toEqual(ratios.map((_, index) => index));
  // Каждый ряд — во всю ширину, без наложений.
  const rows = new Map<number, number>();
  layout.tiles.forEach((tile) => rows.set(tile.y, (rows.get(tile.y) ?? 0) + tile.width));
  rows.forEach((width) => expect(width).toBeCloseTo(1, 6));
  layout.tiles.forEach((tile) => {
    expect(tile.height).toBeGreaterThanOrEqual(0.2);
    expect(tile.height).toBeLessThanOrEqual(0.75);
  });
  return layout;
}

describe('album layout', () => {
  it('puts two landscape photos side by side', () => {
    const layout = check([4 / 3, 4 / 3]);
    expect(layout.tiles.every((tile) => tile.y === 0)).toBe(true);
    expect(layout.height).toBeCloseTo(0.375, 3);
  });

  it('lays out ten mixed photos in rows of up to three, keeping order', () => {
    const layout = check([4 / 3, 3 / 4, 4 / 3, 16 / 9, 1, 3 / 4, 4 / 3, 4 / 3, 9 / 16, 1]);
    const rowCount = new Set(layout.tiles.map((tile) => tile.y)).size;
    expect(rowCount).toBeGreaterThanOrEqual(4);
    expect(rowCount).toBeLessThanOrEqual(6);
    // Альбом не превращается в бесконечную ленту.
    expect(layout.height).toBeLessThan(2.5);
  });

  it('keeps wider photos wider within a row', () => {
    const layout = check([16 / 9, 3 / 4]);
    expect(layout.tiles[0].width).toBeGreaterThan(layout.tiles[1].width);
  });

  it('clamps unknown and extreme proportions', () => {
    expect(albumRatio(null, 100)).toBe(1);
    expect(albumRatio(10000, 10)).toBe(3);
    expect(albumRatio(10, 10000)).toBeCloseTo(1 / 3);
    check([3, 1 / 3, 3]);
    expect(computeAlbumLayout([])).toEqual({ tiles: [], height: 0 });
  });
});
