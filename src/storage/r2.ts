// Helper upload gambar ke R2. Object key konvensi: `recipes/<id>.<ext>`.
// Cache: bucket R2 + custom domain bisa di-cache CDN otomatis.

import type { GeneratedImageBytes } from "../types";

export async function uploadRecipeImage(
  bucket: R2Bucket,
  recipeId: string,
  image: GeneratedImageBytes,
): Promise<string> {
  const key = `recipes/${recipeId}.${image.extension}`;
  await bucket.put(key, image.bytes, {
    httpMetadata: {
      contentType: image.contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return key;
}

export async function deleteRecipeImage(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}
