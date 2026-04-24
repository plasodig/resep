import { html } from "hono/html";
import type { RecipeRow } from "../types";
import { layout } from "./layout";

export function dashboardView(
  rows: RecipeRow[],
  flash?: { kind: "ok" | "error"; msg: string },
) {
  const counts = {
    draft: rows.filter((r) => r.status === "draft").length,
    generated: rows.filter((r) => r.status === "generated").length,
    published: rows.filter((r) => r.status === "published").length,
  };

  const body = html`
    <h1>Daftar Resep</h1>

    ${flash
      ? html`<div class="alert alert-${flash.kind === "ok" ? "ok" : "error"}">${flash.msg}</div>`
      : ""}

    <div class="meta-row">
      <div>
        <span><strong>${rows.length}</strong> total</span>
        <span><span class="badge badge-draft">draft</span> ${counts.draft}</span>
        <span><span class="badge badge-generated">generated</span> ${counts.generated}</span>
        <span><span class="badge badge-published">published</span> ${counts.published}</span>
      </div>
      <div class="actions">
        <form method="post" action="/admin/sync">
          <button class="btn" type="submit">🔄 Sinkronisasi Judul</button>
        </form>
        <form method="post" action="/admin/autobot/run">
          <button class="btn btn-primary" type="submit">⚡ Generate All (Background)</button>
        </form>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Judul</th>
          <th>Kategori</th>
          <th>Status</th>
          <th>Gambar</th>
          <th>Update terakhir</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(
        (r) => html`
            <tr>
              <td><a href="/admin/recipes/${r.id}"><strong>${r.title}</strong></a></td>
              <td>${r.category}</td>
              <td><span class="badge badge-${r.status}">${r.status}</span></td>
              <td>${r.image_key ? "✓" : "—"}</td>
              <td class="small">${formatTime(r.updated_at)}</td>
              <td>
                <div class="row-actions">
                  <a class="btn" href="/admin/recipes/${r.id}">Detail</a>
                  ${r.status === "draft"
            ? html`<form class="inline" method="post" action="/admin/recipes/${r.id}/generate-all">
                        <button class="btn btn-primary" type="submit">Generate</button>
                      </form>`
            : ""}
                </div>
              </td>
            </tr>
          `,
      )}
      </tbody>
    </table>
    <script>
      document.addEventListener("DOMContentLoaded", () => {
        const generateForms = document.querySelectorAll("form.inline");
        generateForms.forEach(form => {
          if (form.action.includes("generate-all")) {
            form.addEventListener("submit", async (e) => {
              e.preventDefault();
              const btn = form.querySelector("button");
              if (btn.disabled) return;
              
              const originalText = btn.innerText;
              btn.innerText = "Memproses...";
              btn.disabled = true;

              try {
                const res = await fetch(form.action, {
                  method: "POST",
                  headers: { "Accept": "application/json" }
                });
                
                const data = await res.json();
                if (data.success) {
                  // Update UI dynamically
                  btn.innerText = "Selesai (Published)";
                  btn.classList.replace("btn-primary", "btn-success");
                  
                  // Update status badge
                  const tr = form.closest("tr");
                  const badge = tr.querySelector(".badge");
                  if (badge) {
                    badge.className = "badge badge-published";
                    badge.innerText = "published";
                  }
                  
                  // Update checkmark for image
                  const tdImg = tr.querySelectorAll("td")[3];
                  if (tdImg) tdImg.innerText = "✓";
                } else {
                  alert("Gagal: " + (data.error || "Unknown error"));
                  btn.innerText = originalText;
                  btn.disabled = false;
                }
              } catch (err) {
                alert("Koneksi gagal atau timeout.");
                btn.innerText = originalText;
                btn.disabled = false;
              }
            });
          }
        });
      });
    </script>
  `;
  return layout("Dashboard", body);
}

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toISOString().replace("T", " ").slice(0, 16);
}
