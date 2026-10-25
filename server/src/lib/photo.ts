import sharp from 'sharp';
import { HttpError } from './errors.ts';

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Turns an uploaded image into a 1200 px wide WebP. Re-encoding also drops
// all metadata, including the GPS position phones write into photos.
export async function processPhoto(input: Buffer) {
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    format = undefined;
  }
  if (!format || !['jpeg', 'png', 'webp'].includes(format)) {
    throw new HttpError(415, 'unsupported_image', 'Bitte ein Foto als JPG, PNG oder WebP hochladen');
  }
  const { data, info } = await sharp(input)
    .rotate() // apply the EXIF orientation before the metadata is dropped
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export const photoUrl = (projectId: string, updatedAt: Date | null | undefined) =>
  updatedAt ? `/api/projects/${projectId}/photo?v=${updatedAt.getTime()}` : null;
