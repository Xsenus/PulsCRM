import { describe, expect, it } from 'vitest';
import { getThumbnailSize, prepareChatImageUpload, shouldCreateThumbnail } from './chatImageThumbnail';

describe('chat image thumbnails', () => {
  it('scales the longest side down to the limit and keeps proportions', () => {
    expect(getThumbnailSize(4000, 3000)).toEqual({ width: 720, height: 540 });
    expect(getThumbnailSize(1000, 4000)).toEqual({ width: 180, height: 720 });
    expect(getThumbnailSize(300, 200)).toEqual({ width: 300, height: 200 });
    expect(getThumbnailSize(10000, 1)).toEqual({ width: 720, height: 1 });
  });

  it('creates thumbnails only for large still images', () => {
    expect(shouldCreateThumbnail({ type: 'image/jpeg', size: 3_000_000 }, 4000, 3000)).toBe(true);
    expect(shouldCreateThumbnail({ type: 'image/png', size: 400_000 }, 600, 400)).toBe(true);
    expect(shouldCreateThumbnail({ type: 'image/png', size: 40_000 }, 600, 400)).toBe(false);
    expect(shouldCreateThumbnail({ type: 'image/gif', size: 5_000_000 }, 2000, 2000)).toBe(false);
    expect(shouldCreateThumbnail({ type: 'application/pdf', size: 5_000_000 }, 2000, 2000)).toBe(false);
  });

  it('skips files that are not images', async () => {
    await expect(prepareChatImageUpload(new File(['abc'], 'a.pdf', { type: 'application/pdf' }))).resolves.toEqual({});
  });
});
