// Helper upload gambar ke KV. Object key konvensi: `recipes/<id>.<ext>`.
// KV digunakan sebagai pengganti R2 jika user tidak memiliki kartu kredit.

import type { GeneratedImageBytes } from "../types";

export async function uploadRecipeImage(
    kv: KVNamespace,
    recipeId: string,
    image: GeneratedImageBytes,
): Promise<string> {
    const key = `recipes/${recipeId}.${image.extension}`;
    // Simpan bytes gambar. KV bisa menyimpan ArrayBuffer langsung.
    // Kita tambahkan metadata contentType agar bisa disajikan dengan benar nanti.
    await kv.put(key, image.bytes, {
        metadata: { contentType: image.contentType },
    });
    return key;
}

export async function deleteRecipeImage(kv: KVNamespace, key: string): Promise<void> {
    await kv.delete(key);
}
