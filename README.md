# Resep Dashboard

Dashboard admin untuk **pre-generate** resep & gambar via Cloudflare Workers AI.
Mobile app (`../resep`) nantinya hanya konsumsi data hasil generate dari endpoint publik —
**hemat token AI** karena generate cuma sekali, bukan per-device.

## Arsitektur

```
Admin (browser)
  ↓ login
[Cloudflare Worker (Hono)]
  ├─ /                    → list resep (HTML)
  ├─ /recipes/:id         → detail + tombol generate / publish (HTML)
  ├─ /api/recipes         → JSON publik untuk mobile (status='published' saja)
  └─ /api/recipes/:id     → JSON detail publik
       ├─ DB metadata    → Cloudflare D1
       ├─ Object gambar  → Cloudflare R2 (URL publik)
       └─ AI generate    → Cloudflare Workers AI (rotasi 64 akun)
```

Stack: Cloudflare Worker + Hono + D1 + R2. Semua **gratis** untuk skala kecil-menengah:
- Workers free: 100k req/hari
- D1 free: 5 GB DB + 5 juta read/hari
- R2 free: 10 GB storage + zero egress fee
- Workers AI: per-akun ada free tier neuron, kita rotasi 64 akun

## Setup awal (sekali saja)

### 1. Install dependencies

```bash
cd resep_dashboard
npm install
```

### 2. Login Cloudflare

```bash
npx wrangler login
```

### 3. Buat D1 database

```bash
npx wrangler d1 create resep-db
```

Output akan menampilkan `database_id` — copy ke `wrangler.toml` (replace `REPLACE_WITH_REAL_D1_ID`).

### 4. Buat R2 bucket

```bash
npx wrangler r2 bucket create resep-images
```

### 5. Aktifkan public access untuk R2 bucket

Cara paling mudah (gratis): aktifkan `r2.dev` URL di dashboard Cloudflare:
1. Buka dashboard Cloudflare → R2 → `resep-images` → Settings
2. Di section "Public access" → enable "r2.dev" subdomain
3. Copy URL bentuknya `https://pub-xxxxxxxx.r2.dev`
4. Edit `wrangler.toml`, set `R2_PUBLIC_BASE = "https://pub-xxxxxxxx.r2.dev"`

(Untuk produksi, lebih bagus pakai custom domain — tetap gratis.)

### 6. Set secrets

```bash
# Password admin (dipakai untuk login dashboard)
npx wrangler secret put ADMIN_PASSWORD

# Random string min 32 char untuk sign cookie
npx wrangler secret put SESSION_SECRET

# Pool 64 akun Cloudflare AI — paste isi data.json sebagai single-line JSON
npx wrangler secret put ACCOUNT_POOL_JSON
```

> Catatan: file `data.json` di project mobile (`../resep/data.json`) bisa di-paste langsung
> ke prompt `wrangler secret put ACCOUNT_POOL_JSON`. Format `[{"id":1,"ns":"...","tk":"..."}, ...]`
> sudah didukung.

### 7. Inisialisasi schema + seed

**Lokal (untuk testing `wrangler dev`):**

```bash
npm run db:init:local
```

**Remote (production):**

```bash
npm run db:init:remote
```

## Development lokal

Buat file `.dev.vars` (copy dari `.dev.vars.example`):

```
ADMIN_PASSWORD="rahasia"
SESSION_SECRET="random-string-min-32-char-aaaaaaaaaa"
ACCOUNT_POOL_JSON='[{"id":1,"ns":"...","tk":"..."}]'
R2_PUBLIC_BASE=""
```

Jalankan:

```bash
npm run dev
```

Buka <http://localhost:8787/login> → masukkan password.

> Catatan: di dev lokal, R2 binding pakai mock filesystem. Untuk test gambar end-to-end,
> deploy ke Cloudflare (langkah berikutnya).

## Deploy

```bash
npm run deploy
```

Worker akan tersedia di `https://resep-dashboard.<subdomain>.workers.dev`.

## Alur pemakaian admin

1. Login ke `/`
2. Pilih resep yang status `draft`
3. Klik **Generate keduanya** (atau pisah: teks dulu, lalu gambar)
4. Tunggu 10–30 detik. Status berubah ke `generated`
5. Cek hasil di halaman detail:
   - Gambar bagus? Tidak → klik **Regenerate gambar**
   - Teks bagus? Tidak → klik **Regenerate teks**
   - Edit manual metadata kalau perlu (judul, deskripsi, tags, dll)
6. Kalau sudah OK → klik **Publish**
7. Resep langsung tersedia di endpoint `/api/recipes` untuk mobile app

## Endpoint untuk mobile app

### `GET /api/recipes`

Manifest semua resep yang sudah di-publish (tanpa ingredients/steps).

```json
{
  "version": 1714123456000,
  "count": 33,
  "recipes": [
    {
      "id": "rendang",
      "title": "Rendang",
      "category": "MainCourse",
      "description": "Hidangan ikonik Minang...",
      "difficulty": "Hard",
      "cookingTimeMinutes": 240,
      "servings": 4,
      "tags": ["minang", "pedas", "gurih", "rempah"],
      "imageUrl": "https://pub-xxx.r2.dev/recipes/rendang.png",
      "updatedAt": 1714123456000,
      "publishedAt": 1714123456000
    }
  ]
}
```

### `GET /api/recipes/:id`

Detail lengkap satu resep (ingredients + steps).

```json
{
  "id": "rendang",
  "title": "Rendang",
  "category": "MainCourse",
  "description": "...",
  "difficulty": "Hard",
  "cookingTimeMinutes": 240,
  "servings": 4,
  "tags": ["minang", "pedas"],
  "imageUrl": "https://pub-xxx.r2.dev/recipes/rendang.png",
  "ingredients": [
    { "name": "daging sapi", "quantity": "1", "unit": "kg" }
  ],
  "steps": [
    { "order": 1, "instruction": "Potong daging melawan serat..." }
  ],
  "publishedAt": 1714123456000
}
```

## Migrasi mobile app `../resep` (langkah berikutnya, di luar scope dashboard ini)

Setelah dashboard berjalan dan berisi resep ter-publish, mobile app perlu di-refactor:

1. Hapus modul AI di mobile (`core/data/ai/*`, account pool loader, dll)
2. Ganti `RecipeRepositoryImpl` jadi konsumen API endpoint dashboard
3. Hapus `data.json` dari APK + tasks `copyAccountPool` di `core/data/build.gradle.kts`
4. Tambah env var `RESEP_API_BASE` (URL Worker) di `local.properties` / build config

APK akan jauh lebih ringan, dan kredensial AI tidak lagi terekspos.

## Troubleshooting

- **`ACCOUNT_POOL_JSON kosong atau bukan array`** — secret belum di-set. Jalankan
  `wrangler secret put ACCOUNT_POOL_JSON` dan paste isi `data.json`.
- **Generate gagal terus** — cek di Cloudflare dashboard apakah model
  `@cf/mistralai/mistral-small-3.1-24b-instruct` masih aktif untuk akun di pool.
  Fallback otomatis ke Llama 3.1 8B kalau primary gagal.
- **Gambar 404 di mobile app** — pastikan `R2_PUBLIC_BASE` di `wrangler.toml` di-set
  ke URL `r2.dev` atau custom domain yang sudah aktif.
