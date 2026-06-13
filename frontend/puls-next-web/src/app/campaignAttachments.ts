import type { StoredFileDto } from './types';

export function isImageStoredFile(file: StoredFileDto): boolean {
  return (file.contentType || '').toLowerCase().startsWith('image/');
}

export function getStoredFileDisplayExtension(file: StoredFileDto): string {
  const source = file.originalFileName || file.storedFileName || '';
  const extension = source.includes('.') ? source.split('.').pop() : '';
  return extension ? extension.toUpperCase() : 'IMG';
}
