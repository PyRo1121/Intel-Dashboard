export function getTelegramCollageLayoutClass(count: number): string {
  if (count <= 1) return "telegram-photo-collage--single";
  if (count === 2) return "telegram-photo-collage--double";
  if (count === 3) return "telegram-photo-collage--triple";
  return "telegram-photo-collage--quad";
}

export function getVisibleTelegramPhotos<T>(
  photos: readonly T[],
  limit = 4,
): T[] {
  return photos.slice(0, Math.max(0, limit));
}

export function getHiddenTelegramPhotoCount(
  totalPhotos: number,
  visibleLimit = 4,
): number {
  return Math.max(0, totalPhotos - Math.max(0, visibleLimit));
}

export function getTelegramCollageCellClass(count: number, index: number): string {
  if (count === 3) {
    if (index === 0) return "telegram-photo-cell telegram-photo-cell--hero";
    if (index === 1) return "telegram-photo-cell telegram-photo-cell--side-top";
    if (index === 2) return "telegram-photo-cell telegram-photo-cell--side-bottom";
  }
  return "telegram-photo-cell";
}
