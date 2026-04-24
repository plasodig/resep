import { html, raw } from "hono/html";
import type { RecipeFull, RecipeRow } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  All: "Semua",
  MainCourse: "Hidangan Utama",
  Soup: "Sup & Kuah",
  Appetizer: "Pembuka",
  Dessert: "Pencuci Mulut",
  Beverage: "Minuman",
  Snack: "Camilan",
  SideDish: "Lauk Pauk",
  Sambal: "Sambal",
};

const CATEGORY_ICONS: Record<string, string> = {
  All: "🍽️",
  MainCourse: "🍛",
  Soup: "🍲",
  Appetizer: "🥗",
  Dessert: "🍰",
  Beverage: "🥤",
  Snack: "🍢",
  SideDish: "🥘",
  Sambal: "🌶️",
};

export function landingPage(rows: RecipeRow[]) {
  const categories = ["All", ...new Set(rows.map((r) => r.category))];

  return html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resep Nusantara — Koleksi Resep Masakan Indonesia</title>
  <meta name="description" content="Jelajahi ratusan resep masakan Indonesia autentik lengkap dengan bahan dan langkah memasak." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${raw(LANDING_CSS)}</style>
</head>
<body>
  <header class="hero">
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <span class="hero-badge">🇮🇩 100% Resep Asli Indonesia</span>
      <h1>Resep <span class="gradient-text">Nusantara</span></h1>
      <p class="hero-subtitle">Jelajahi <strong>${rows.length}</strong> resep masakan Indonesia autentik — dari Sabang sampai Merauke</p>
      <div class="hero-search">
        <input type="text" id="searchInput" placeholder="Cari resep... (contoh: Nasi Goreng)" autocomplete="off" />
      </div>
    </div>
  </header>

  <main>
    <nav class="category-tabs" id="categoryTabs">
      ${categories.map(
        (cat) => html`
          <button class="tab ${cat === "All" ? "active" : ""}" data-cat="${cat}">
            <span class="tab-icon">${CATEGORY_ICONS[cat] || "🍽️"}</span>
            <span class="tab-label">${CATEGORY_LABELS[cat] || cat}</span>
          </button>
        `,
      )}
    </nav>

    <div class="recipe-grid" id="recipeGrid">
      ${rows.map(
        (r) => html`
          <a href="/resep/${r.id}" class="recipe-card" data-cat="${r.category}" data-title="${r.title.toLowerCase()}">
            <div class="card-img-wrap">
              ${r.image_key
                ? html`<img src="/api/images/${r.image_key}" alt="${r.title}" loading="lazy" />`
                : html`<div class="card-placeholder"><span>📷</span></div>`}
              <span class="card-badge">${CATEGORY_LABELS[r.category] || r.category}</span>
            </div>
            <div class="card-body">
              <h3>${r.title}</h3>
              <p class="card-desc">${r.description ? r.description.slice(0, 100) + (r.description.length > 100 ? "…" : "") : "Resep masakan Indonesia"}</p>
              <div class="card-meta">
                ${r.cooking_time_minutes ? html`<span>⏱ ${r.cooking_time_minutes} menit</span>` : ""}
                ${r.servings ? html`<span>👥 ${r.servings} porsi</span>` : ""}
                ${r.difficulty ? html`<span>📊 ${r.difficulty}</span>` : ""}
              </div>
            </div>
          </a>
        `,
      )}
    </div>

    <div class="empty-state" id="emptyState" style="display:none;">
      <span class="empty-icon">🔍</span>
      <p>Tidak ada resep yang cocok dengan pencarian Anda.</p>
    </div>
  </main>

  <footer>
    <p>&copy; ${new Date().getFullYear()} Resep Nusantara — <a href="https://resep.plasodig.my.id">resep.plasodig.my.id</a></p>
    <div style="margin-top: 12px; display: flex; justify-content: center; gap: 16px;">
      <a href="/privacy-policy">Privacy Policy</a>
      <a href="/contacts">Contact Us</a>
    </div>
  </footer>

  <script>${raw(LANDING_JS)}</script>
</body>
</html>`;
}

export function recipeDetailPage(full: RecipeFull) {
  const r = full.recipe;
  const tags = r.tags_csv ? r.tags_csv.split(",") : [];

  return html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${r.title} — Resep Nusantara</title>
  <meta name="description" content="${r.description || `Resep ${r.title} lengkap dengan bahan dan cara memasak.`}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${raw(LANDING_CSS)}</style>
</head>
<body>
  <nav class="detail-nav">
    <a href="/resep" class="back-link">← Kembali ke Daftar Resep</a>
  </nav>

  <article class="detail">
    <div class="detail-hero">
      ${full.imageUrl
        ? html`<img src="${full.imageUrl}" alt="${r.title}" class="detail-img" />`
        : html`<div class="detail-img-placeholder"><span>📷</span></div>`}
      <div class="detail-hero-info">
        <span class="detail-badge">${CATEGORY_LABELS[r.category] || r.category}</span>
        <h1>${r.title}</h1>
        <p class="detail-desc">${r.description}</p>
        <div class="detail-stats">
          ${r.cooking_time_minutes ? html`<div class="stat"><span class="stat-val">⏱ ${r.cooking_time_minutes}</span><span class="stat-label">menit</span></div>` : ""}
          ${r.servings ? html`<div class="stat"><span class="stat-val">👥 ${r.servings}</span><span class="stat-label">porsi</span></div>` : ""}
          ${r.difficulty ? html`<div class="stat"><span class="stat-val">📊 ${r.difficulty}</span><span class="stat-label">tingkat</span></div>` : ""}
        </div>
        ${tags.length > 0
          ? html`<div class="tags">${tags.map((t) => html`<span class="tag">${t.trim()}</span>`)}</div>`
          : ""}
      </div>
    </div>

    <div class="detail-content">
      <section class="detail-section">
        <h2>🧂 Bahan-Bahan</h2>
        ${full.ingredients.length > 0
          ? html`<ul class="ing-list">
              ${full.ingredients.map(
                (i) => html`<li>
                  <span class="ing-name">${i.name}</span>
                  <span class="ing-qty">${i.quantity} ${i.unit}</span>
                </li>`,
              )}
            </ul>`
          : html`<p class="muted">Bahan belum tersedia.</p>`}
      </section>

      <section class="detail-section">
        <h2>👩‍🍳 Cara Memasak</h2>
        ${full.steps.length > 0
          ? html`<ol class="step-list">
              ${full.steps.map(
                (s) => html`<li>
                  <div class="step-num">${s.step_order}</div>
                  <p>${s.instruction}</p>
                </li>`,
              )}
            </ol>`
          : html`<p class="muted">Langkah memasak belum tersedia.</p>`}
      </section>
    </div>
  </article>

  <footer>
    <p>&copy; ${new Date().getFullYear()} Resep Nusantara — <a href="https://resep.plasodig.my.id">resep.plasodig.my.id</a></p>
    <div style="margin-top: 12px; display: flex; justify-content: center; gap: 16px;">
      <a href="/privacy-policy">Privacy Policy</a>
      <a href="/contacts">Contact Us</a>
    </div>
  </footer>
</body>
</html>`;
}

/* ─── CSS ─── */
const LANDING_CSS = `
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #22263a;
    --border: #2a2e3f;
    --text: #e8e9ed;
    --muted: #8b8fa3;
    --primary: #f97316;
    --primary-glow: rgba(249,115,22,0.15);
    --accent: #10b981;
    --gradient: linear-gradient(135deg, #f97316 0%, #ef4444 50%, #ec4899 100%);
    --card-radius: 16px;
    --font: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font); background: var(--bg); color: var(--text); min-height: 100vh; }
  a { color: inherit; text-decoration: none; }

  /* ── Hero ── */
  .hero { position: relative; overflow: hidden; padding: 80px 24px 60px;
          background: linear-gradient(to bottom, #1a1025 0%, var(--bg) 100%); text-align: center; }
  .hero-overlay { position: absolute; inset: 0;
                  background: radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.12) 0%, transparent 70%); pointer-events: none; }
  .hero-content { position: relative; max-width: 680px; margin: 0 auto; }
  .hero-badge { display: inline-block; padding: 6px 16px; border-radius: 50px;
                background: var(--surface2); border: 1px solid var(--border);
                font-size: 13px; font-weight: 500; color: var(--muted); margin-bottom: 20px; }
  .hero h1 { font-size: clamp(2.4rem, 6vw, 3.6rem); font-weight: 800; line-height: 1.15; margin-bottom: 16px; }
  .gradient-text { background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                   background-clip: text; }
  .hero-subtitle { font-size: 17px; color: var(--muted); line-height: 1.6; margin-bottom: 32px; }
  .hero-subtitle strong { color: var(--primary); }
  .hero-search { max-width: 480px; margin: 0 auto; }
  .hero-search input { width: 100%; padding: 14px 20px; border-radius: 50px; border: 1px solid var(--border);
                       background: var(--surface); color: var(--text); font: 15px var(--font);
                       outline: none; transition: border-color .2s, box-shadow .2s; }
  .hero-search input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-glow); }
  .hero-search input::placeholder { color: var(--muted); }

  /* ── Category Tabs ── */
  main { max-width: 1280px; margin: 0 auto; padding: 0 24px 60px; }
  .category-tabs { display: flex; gap: 8px; padding: 24px 0; overflow-x: auto; scrollbar-width: none;
                   -webkit-overflow-scrolling: touch; }
  .category-tabs::-webkit-scrollbar { display: none; }
  .tab { display: flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 50px;
         border: 1px solid var(--border); background: var(--surface); color: var(--muted);
         font: 13px/1 var(--font); font-weight: 600; cursor: pointer; white-space: nowrap;
         transition: all .2s; }
  .tab:hover { border-color: var(--primary); color: var(--text); }
  .tab.active { background: var(--primary); border-color: var(--primary); color: #fff; }
  .tab-icon { font-size: 16px; }

  /* ── Recipe Grid ── */
  .recipe-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
  .recipe-card { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border);
                 border-radius: var(--card-radius); overflow: hidden; transition: transform .25s, box-shadow .25s, border-color .25s; }
  .recipe-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,.35);
                       border-color: var(--primary); }
  .card-img-wrap { position: relative; aspect-ratio: 4/3; overflow: hidden; background: var(--surface2); }
  .card-img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s; }
  .recipe-card:hover .card-img-wrap img { transform: scale(1.06); }
  .card-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center;
                      font-size:48px; color: var(--muted); background: var(--surface2); }
  .card-badge { position: absolute; top: 12px; left: 12px; padding: 4px 12px; border-radius: 50px;
                background: rgba(15,17,23,.75); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.08);
                font-size: 11px; font-weight: 600; color: var(--primary); text-transform: uppercase; letter-spacing: .5px; }
  .card-body { padding: 16px 18px 20px; flex: 1; display: flex; flex-direction: column; }
  .card-body h3 { font-size: 17px; font-weight: 700; margin-bottom: 6px; line-height: 1.3; }
  .card-desc { font-size: 13px; color: var(--muted); line-height: 1.5; flex: 1; margin-bottom: 12px;
               display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .card-meta { display: flex; gap: 12px; font-size: 12px; color: var(--muted); }
  .card-meta span { display: flex; align-items: center; gap: 3px; }

  /* ── Empty ── */
  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-icon { font-size: 48px; display: block; margin-bottom: 16px; }
  .empty-state p { color: var(--muted); font-size: 15px; }

  /* ── Footer ── */
  footer { text-align: center; padding: 32px 24px; border-top: 1px solid var(--border);
           color: var(--muted); font-size: 13px; }
  footer a { color: var(--primary); }

  /* ── Detail Page ── */
  .detail-nav { padding: 16px 24px; max-width: 1100px; margin: 0 auto; }
  .back-link { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 50px;
               background: var(--surface); border: 1px solid var(--border); font-size: 14px; font-weight: 600;
               color: var(--muted); transition: all .2s; }
  .back-link:hover { border-color: var(--primary); color: var(--text); }

  .detail { max-width: 1100px; margin: 0 auto; padding: 0 24px 48px; }
  .detail-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; align-items: start; margin-bottom: 40px; }
  .detail-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--card-radius);
                border: 1px solid var(--border); }
  .detail-img-placeholder { aspect-ratio: 4/3; border-radius: var(--card-radius); background: var(--surface2);
                            display: flex; align-items: center; justify-content: center; font-size: 64px;
                            border: 1px solid var(--border); }
  .detail-badge { display: inline-block; padding: 5px 14px; border-radius: 50px; background: var(--primary-glow);
                  color: var(--primary); font-size: 12px; font-weight: 700; text-transform: uppercase;
                  letter-spacing: .5px; margin-bottom: 12px; }
  .detail-hero-info h1 { font-size: 2rem; font-weight: 800; margin-bottom: 12px; line-height: 1.2; }
  .detail-desc { color: var(--muted); font-size: 15px; line-height: 1.7; margin-bottom: 24px; }
  .detail-stats { display: flex; gap: 24px; margin-bottom: 20px; }
  .stat { display: flex; flex-direction: column; align-items: center; padding: 14px 20px;
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px; min-width: 90px; }
  .stat-val { font-size: 18px; font-weight: 700; }
  .stat-label { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { padding: 4px 12px; border-radius: 50px; background: var(--surface2); border: 1px solid var(--border);
         font-size: 12px; color: var(--muted); }

  .detail-content { display: grid; grid-template-columns: 1fr 1.4fr; gap: 36px; }
  .detail-section h2 { font-size: 20px; font-weight: 700; margin-bottom: 20px;
                       padding-bottom: 12px; border-bottom: 2px solid var(--border); }
  .ing-list { list-style: none; }
  .ing-list li { display: flex; justify-content: space-between; padding: 12px 0;
                 border-bottom: 1px solid var(--border); font-size: 14px; }
  .ing-list li:last-child { border-bottom: none; }
  .ing-name { font-weight: 600; }
  .ing-qty { color: var(--primary); font-weight: 500; }

  .step-list { list-style: none; counter-reset: step; }
  .step-list li { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--border); }
  .step-list li:last-child { border-bottom: none; }
  .step-num { flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%;
              background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center;
              font-size: 14px; font-weight: 700; }
  .step-list p { font-size: 14px; line-height: 1.7; color: var(--text); }
  .muted { color: var(--muted); font-size: 14px; }

  @media (max-width: 768px) {
    .detail-hero { grid-template-columns: 1fr; }
    .detail-content { grid-template-columns: 1fr; }
    .detail-stats { flex-wrap: wrap; }
    .hero { padding: 60px 20px 40px; }
    .recipe-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
  }
`;

/* ─── JS ─── */
const LANDING_JS = `
  const grid = document.getElementById('recipeGrid');
  const cards = Array.from(grid.querySelectorAll('.recipe-card'));
  const empty = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  let activeCat = 'All';

  document.getElementById('categoryTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    activeCat = btn.dataset.cat;
    filterCards();
  });

  searchInput.addEventListener('input', () => filterCards());

  function filterCards() {
    const q = searchInput.value.toLowerCase().trim();
    let visible = 0;
    cards.forEach(card => {
      const matchCat = activeCat === 'All' || card.dataset.cat === activeCat;
      const matchSearch = !q || card.dataset.title.includes(q);
      const show = matchCat && matchSearch;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    empty.style.display = visible === 0 ? '' : 'none';
  }
`;
