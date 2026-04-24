import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

export function layout(title: string, body: HtmlEscapedString | Promise<HtmlEscapedString>) {
  return html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Resep Dashboard</title>
  <style>${raw(BASE_CSS)}</style>
</head>
<body>
  <header class="topbar">
    <a href="/admin" class="brand">Resep Dashboard</a>
    <nav>
      <a href="/admin">Daftar</a>
      <a href="/admin/requests">Permintaan</a>
      <a href="/" target="_blank" rel="noopener">Landing Page</a>
      <a href="/api/recipes" target="_blank" rel="noopener">API publik</a>
      <form method="post" action="/logout" style="display:inline">
        <button type="submit" class="link">Logout</button>
      </form>
    </nav>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

const BASE_CSS = `
  :root {
    --bg: #f6f7f9;
    --surface: #fff;
    --border: #e3e5e8;
    --text: #1a1d21;
    --muted: #6b7280;
    --primary: #1f5c47;
    --primary-soft: #e6f1ec;
    --warn: #b45309;
    --warn-soft: #fef3c7;
    --ok: #047857;
    --ok-soft: #d1fae5;
    --danger: #b91c1c;
    --danger-soft: #fee2e2;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         color: var(--text); background: var(--bg); }
  .topbar { display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px; background: var(--surface); border-bottom: 1px solid var(--border); }
  .topbar nav { display: flex; gap: 16px; align-items: center; }
  .topbar nav a, .topbar .link { color: var(--text); text-decoration: none; font-size: 13px; }
  .topbar nav a:hover, .topbar .link:hover { color: var(--primary); }
  .brand { font-weight: 600; color: var(--primary) !important; font-size: 15px; }
  main { max-width: 1100px; margin: 24px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin: 0 0 16px; }
  h2 { font-size: 17px; margin: 24px 0 12px; }
  table { width: 100%; border-collapse: collapse; background: var(--surface); }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
  th { font-size: 12px; text-transform: uppercase; color: var(--muted); font-weight: 600; }
  tr:hover td { background: #fafbfc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px;
           font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .badge-draft { background: var(--warn-soft); color: var(--warn); }
  .badge-generated { background: var(--primary-soft); color: var(--primary); }
  .badge-published { background: var(--ok-soft); color: var(--ok); }
  .badge-danger { background: var(--danger-soft); color: var(--danger); }
  .btn { display: inline-block; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border);
         background: var(--surface); cursor: pointer; font-size: 13px; text-decoration: none; color: var(--text); }
  .btn:hover { background: #f3f4f6; }
  .btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
  .btn-primary:hover { background: #174738; }
  .btn-danger { background: var(--surface); color: var(--danger); border-color: var(--danger); }
  .btn-danger:hover { background: var(--danger-soft); }
  .link { background: none; border: none; padding: 0; cursor: pointer; color: inherit; font: inherit; }
  form.inline { display: inline; }
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
           padding: 20px; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; font-weight: 600; }
  input[type=text], input[type=number], input[type=password], select, textarea {
    width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px;
    font: inherit; background: #fff;
  }
  textarea { min-height: 80px; resize: vertical; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .image-preview { width: 100%; max-width: 320px; aspect-ratio: 4/3; object-fit: cover;
                   border-radius: 8px; border: 1px solid var(--border); background: #eee; }
  .empty-image { width: 320px; aspect-ratio: 4/3; background: #f0f1f4; border-radius: 8px;
                 display: flex; align-items: center; justify-content: center; color: var(--muted);
                 border: 1px dashed var(--border); font-size: 12px; }
  .alert { padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; }
  .alert-error { background: var(--danger-soft); color: var(--danger); border: 1px solid #fca5a5; }
  .alert-ok { background: var(--ok-soft); color: var(--ok); border: 1px solid #6ee7b7; }
  .login-card { max-width: 360px; margin: 80px auto; }
  .small { font-size: 12px; color: var(--muted); }
  .row-actions { display: flex; gap: 6px; }
  ul.steps { padding-left: 20px; margin: 0; }
  ul.steps li { margin-bottom: 6px; }
  ul.ingredients { list-style: none; padding: 0; margin: 0; }
  ul.ingredients li { padding: 4px 0; border-bottom: 1px dotted var(--border); display: flex; justify-content: space-between; }
  ul.ingredients li:last-child { border-bottom: none; }
  .meta-row { display: flex; gap: 16px; flex-wrap: wrap; color: var(--muted); font-size: 13px; margin-bottom: 12px;
              justify-content: space-between; align-items: center; }
`;
