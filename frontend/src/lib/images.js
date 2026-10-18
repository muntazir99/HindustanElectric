// Website pictures are shrunk on this device before upload: small files keep the website fast on mobile data
// and need nothing extra on the server.

/** Width and height that fit inside max × max, keeping the shape; never enlarged. */
export function fit(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return [Math.round(width * scale), Math.round(height * scale)];
}

/**
 * The picture as a smaller file: WebP where the browser can make it, else PNG (keepsAlpha: a see-through
 * cut-out) or JPEG. Returns a File ready to upload.
 */
export async function shrink(file, { max = 1200, keepsAlpha = false } = {}) {
  const bitmap = await createImageBitmap(file);
  const [width, height] = fit(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const encode = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
  let blob = await encode("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await encode(keepsAlpha ? "image/png" : "image/jpeg");
  const ext = blob.type.split("/")[1].replace("jpeg", "jpg");
  return new File([blob], `picture.${ext}`, { type: blob.type });
}
