import data from './placeholder-images.json';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

const fallbackImage: ImagePlaceholder = {
  id: 'course-generic',
  description: 'Generic course image',
  imageUrl: '/images/hero-browser.png',
  imageHint: 'browser window',
};

export const PlaceHolderImages: ImagePlaceholder[] = data.placeholderImages;

export function getPlaceholderImage(id?: string | null): ImagePlaceholder {
  const found = id ? PlaceHolderImages.find((img) => img.id === id) : undefined;
  return found || fallbackImage;
}
