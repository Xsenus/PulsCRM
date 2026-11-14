/**
 * Раскладка альбома из нескольких фото «как в мессенджерах»: фото идут по порядку рядами,
 * в ряду от 1 до 3 штук, ширина ряда — во всю ширину альбома, высоты рядов близки к целевой.
 * Пропорции фото сохраняются (с небольшой обрезкой, если ряд пришлось ограничить по высоте).
 * Все размеры — в долях ширины альбома, поэтому раскладка резиновая.
 */

export interface AlbumTile {
  index: number;
  /** Левый край и ширина — доля ширины альбома (0..1). */
  x: number;
  width: number;
  /** Верх и высота — в долях ширины альбома. */
  y: number;
  height: number;
}

export interface AlbumLayout {
  tiles: AlbumTile[];
  /** Высота альбома в долях ширины. */
  height: number;
}

/** Целевая высота ряда (треть ширины) и пределы, чтобы не было «полосок» и огромных портретов. */
const TARGET_ROW = 0.36;
const MIN_ROW = 0.2;
const MAX_ROW = 0.75;
const MAX_PER_ROW = 3;

/** Пропорция ширина/высота; без размеров — квадрат; крайние значения ограничиваем. */
export function albumRatio(width?: number | null, height?: number | null) {
  if (!width || !height || width <= 0 || height <= 0) {
    return 1;
  }

  return Math.min(3, Math.max(1 / 3, width / height));
}

export function computeAlbumLayout(ratios: number[]): AlbumLayout {
  const count = ratios.length;
  if (count === 0) {
    return { tiles: [], height: 0 };
  }

  // best[i] — лучшая раскладка первых i фото: цена и длина последнего ряда.
  const best: Array<{ cost: number; take: number }> = [{ cost: 0, take: 0 }];
  for (let end = 1; end <= count; end += 1) {
    best[end] = { cost: Number.POSITIVE_INFINITY, take: 1 };
    for (let take = 1; take <= Math.min(MAX_PER_ROW, end); take += 1) {
      const rowHeight = 1 / ratios.slice(end - take, end).reduce((sum, value) => sum + value, 0);
      const clamped = Math.min(MAX_ROW, Math.max(MIN_ROW, rowHeight));
      // Штраф за отклонение от целевой высоты и за обрезку, если ряд вышел за пределы;
      // одиночное фото в ряду альбома допустимо, но реже.
      let cost = (clamped - TARGET_ROW) ** 2 + (rowHeight - clamped) ** 2 * 4;
      if (take === 1 && count > 1) {
        cost += 0.02;
      }

      if (best[end - take].cost + cost < best[end].cost) {
        best[end] = { cost: best[end - take].cost + cost, take };
      }
    }
  }

  const rows: number[][] = [];
  for (let end = count; end > 0; end -= best[end].take) {
    const start = end - best[end].take;
    rows.unshift(Array.from({ length: end - start }, (_, offset) => start + offset));
  }

  const tiles: AlbumTile[] = [];
  let y = 0;
  for (const row of rows) {
    const sum = row.reduce((total, index) => total + ratios[index], 0);
    const height = Math.min(MAX_ROW, Math.max(MIN_ROW, 1 / sum));
    let x = 0;
    row.forEach((index, position) => {
      // Последний в ряду добирает остаток, чтобы не было щели от округления.
      const width = position === row.length - 1 ? 1 - x : ratios[index] / sum;
      tiles.push({ index, x, width, y, height });
      x += width;
    });
    y += height;
  }

  return { tiles, height: y };
}
