import { html } from "hono/html";
import type { RecipeFull } from "../types";
import { publicLayout } from "./public_layout";

export function recipeDetailView(full: RecipeFull) {
  const { recipe, ingredients, steps } = full;
  
  return publicLayout(
    recipe.title,
    html`
      <div class="recipe-detail-header">
        <div class="container detail-hero">
          <div class="detail-info">
            <nav class="breadcrumb">
              <a href="/">Beranda</a> / <span class="current">${recipe.title}</span>
            </nav>
            <h1>${recipe.title}</h1>
            <div class="meta-badges">
              <span class="badge-item">Kategori: <strong>${recipe.category}</strong></span>
              <span class="badge-item">Kesulitan: <strong>${recipe.difficulty}</strong></span>
              <span class="badge-item">Waktu: <strong>${recipe.cooking_time_minutes} menit</strong></span>
            </div>
            <p class="recipe-desc">${recipe.description}</p>
          </div>
          <div class="detail-image">
             ${recipe.image_key 
               ? html`<img src="/api/images/recipes/${recipe.id}.png" alt="${recipe.title}" />`
               : html`<div class="placeholder-img"></div>`}
          </div>
        </div>
      </div>

      <div class="container recipe-body">
        <div class="recipe-grid-layout">
          <div class="ingredients-section">
            <h2>Bahan-bahan</h2>
            <ul class="ingredients-list">
              ${ingredients.map(i => html`
                <li>
                  <span class="qty">${i.quantity} ${i.unit}</span>
                  <span class="name">${i.name}</span>
                </li>
              `)}
            </ul>
          </div>

          <div class="steps-section">
            <h2>Langkah-langkah Memasak</h2>
            <div class="steps-list">
              ${steps.map(s => html`
                <div class="step-item">
                  <div class="step-num">${s.step_order}</div>
                  <div class="step-text">${s.instruction}</div>
                </div>
              `)}
            </div>
          </div>
        </div>
      </div>

      <style>
        .recipe-detail-header { background: var(--bg-alt); padding: 60px 0; border-bottom: 1px solid var(--border); }
        .detail-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: start; }
        .breadcrumb { margin-bottom: 24px; font-size: 14px; color: var(--text-muted); }
        .breadcrumb a { color: var(--primary); text-decoration: none; }
        .detail-info h1 { font-family: 'Playfair Display', serif; font-size: 48px; margin: 0 0 24px; color: var(--primary); }
        .meta-badges { display: flex; gap: 20px; margin-bottom: 32px; flex-wrap: wrap; }
        .badge-item { background: white; padding: 6px 16px; border-radius: 50px; border: 1px solid var(--border); font-size: 14px; }
        .recipe-desc { font-size: 18px; color: var(--text-muted); }
        
        .detail-image img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 24px; box-shadow: var(--shadow-lg); }
        
        .recipe-body { padding: 80px 0; }
        .recipe-grid-layout { display: grid; grid-template-columns: 350px 1fr; gap: 80px; align-items: start; }
        
        .ingredients-list { list-style: none; padding: 0; margin: 0; }
        .ingredients-list li { padding: 12px 0; border-bottom: 1px solid var(--border); display: flex; gap: 12px; }
        .ingredients-list .qty { font-weight: 600; color: var(--primary); min-width: 80px; }
        
        .steps-list { display: flex; flex-direction: column; gap: 32px; }
        .step-item { display: flex; gap: 24px; }
        .step-num { 
          width: 40px; height: 40px; background: var(--accent); color: white; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;
        }
        .step-text { font-size: 16px; padding-top: 8px; }

        @media (max-width: 900px) {
          .detail-hero { grid-template-columns: 1fr; }
          .recipe-grid-layout { grid-template-columns: 1fr; gap: 60px; }
          .detail-image { order: -1; }
        }
      </style>
    `
  );
}
