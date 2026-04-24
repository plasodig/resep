import { html } from "hono/html";
import type { ReportWithRecipe } from "../db";
import { layout } from "./layout";

export function reportsView(
  rows: ReportWithRecipe[],
  flash?: { kind: "ok" | "error"; msg: string },
) {
  const body = html`
    <h1>Laporan Resep</h1>
    <p class="small">
      Laporan dari tombol "Laporkan" di mobile app. Threshold auto-unpublish: 3 laporan →
      status otomatis jadi <code>generated</code> (disembunyikan dari API publik) untuk
      ditinjau ulang admin.
    </p>

    ${flash
      ? html`<div class="alert alert-${flash.kind === "ok" ? "ok" : "error"}">${flash.msg}</div>`
      : ""}

    ${rows.length === 0
      ? html`<div class="panel"><p class="small">Belum ada laporan.</p></div>`
      : html`
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Resep</th>
                <th>Status resep</th>
                <th>Alasan</th>
                <th>Detail</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(
                (r) => html`
                  <tr>
                    <td class="small">${formatTime(r.created_at)}</td>
                    <td>
                      ${r.recipe_title
                        ? html`<a href="/admin/recipes/${r.recipe_id}">${r.recipe_title}</a>`
                        : html`<span class="small">${r.recipe_id}</span>`}
                    </td>
                    <td>
                      ${r.recipe_status
                        ? html`<span class="badge badge-${r.recipe_status}">${r.recipe_status}</span>`
                        : "—"}
                    </td>
                    <td>${reasonBadge(r.reason)}</td>
                    <td class="small">${r.detail || "—"}</td>
                    <td class="small">${r.client_ip ?? "—"}</td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        `}
  `;
  return layout("Laporan", body);
}

function reasonBadge(reason: string) {
  const label: Record<string, string> = {
    inaccurate: "Tidak akurat",
    offensive: "Menyinggung",
    dangerous: "Berbahaya",
    other: "Lainnya",
  };
  const cls = reason === "dangerous" ? "badge-danger"
    : reason === "offensive" ? "badge-danger"
    : "badge-draft";
  return html`<span class="badge ${cls}">${label[reason] ?? reason}</span>`;
}

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toISOString().replace("T", " ").slice(0, 16);
}
