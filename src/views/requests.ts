import { html } from "hono/html";
import type { GenerationRequestRow } from "../types";
import { layout } from "./layout";

export function requestsView(
  rows: GenerationRequestRow[],
  flash?: { kind: "ok" | "error"; msg: string },
) {
  const counts = {
    processing: rows.filter((r) => r.status === "processing").length,
    completed: rows.filter((r) => r.status === "completed").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };

  const body = html`
    <h1>Riwayat Generate</h1>
    <p class="small">
      Permintaan auto-generate dari halaman pencarian mobile. Mobile app kirim query →
      server langsung generate di background → mobile polling sampai selesai. Halaman ini
      cuma monitoring — tidak ada aksi moderasi.
    </p>

    ${flash
      ? html`<div class="alert alert-${flash.kind === "ok" ? "ok" : "error"}">${flash.msg}</div>`
      : ""}

    <div class="meta-row">
      <div>
        <span><strong>${rows.length}</strong> total</span>
        <span><span class="badge badge-draft">processing</span> ${counts.processing}</span>
        <span><span class="badge badge-published">completed</span> ${counts.completed}</span>
        <span><span class="badge badge-danger">failed</span> ${counts.failed}</span>
      </div>
    </div>

    ${rows.length === 0
      ? html`<div class="panel"><p class="small">Belum ada permintaan.</p></div>`
      : html`
          <table>
            <thead>
              <tr>
                <th>Query user</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Diajukan</th>
                <th>Hasil / Error</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(
                (r) => html`
                  <tr>
                    <td><strong>${r.query}</strong></td>
                    <td class="small">${r.slug_target}</td>
                    <td>${statusBadge(r.status)}</td>
                    <td class="small">${formatTime(r.requested_at)}</td>
                    <td class="small">
                      ${r.status === "completed" && r.resulting_recipe_id
                        ? html`<a href="/admin/recipes/${r.resulting_recipe_id}">${r.resulting_recipe_id}</a>`
                        : r.status === "failed"
                          ? html`<span style="color: var(--danger)">${r.error_message ?? "—"}</span>`
                          : "—"}
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        `}
  `;
  return layout("Riwayat Generate", body);
}

function statusBadge(status: string) {
  const cls =
    status === "processing"
      ? "badge-draft"
      : status === "completed"
        ? "badge-published"
        : "badge-danger";
  return html`<span class="badge ${cls}">${status}</span>`;
}

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toISOString().replace("T", " ").slice(0, 16);
}
