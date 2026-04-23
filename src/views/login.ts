import { html } from "hono/html";

export function loginView(error?: string) {
  return html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login — Resep Dashboard</title>
  <style>
    body { margin: 0; font: 14px/1.5 system-ui, sans-serif; background: #f6f7f9; color: #1a1d21; }
    .card { max-width: 360px; margin: 100px auto; background: #fff; padding: 28px;
            border-radius: 10px; border: 1px solid #e3e5e8; }
    h1 { font-size: 19px; margin: 0 0 20px; color: #1f5c47; }
    label { display: block; font-size: 12px; color: #6b7280; margin: 12px 0 4px; font-weight: 600; }
    input { width: 100%; padding: 9px 10px; border: 1px solid #e3e5e8; border-radius: 6px;
            font: inherit; box-sizing: border-box; }
    button { margin-top: 18px; width: 100%; padding: 10px; background: #1f5c47;
             color: #fff; border: none; border-radius: 6px; font: inherit; cursor: pointer; }
    button:hover { background: #174738; }
    .err { background: #fee2e2; color: #b91c1c; padding: 8px 12px; border-radius: 6px;
           font-size: 13px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Resep Dashboard</h1>
    ${error ? html`<div class="err">${error}</div>` : ""}
    <form method="post" action="/login">
      <label for="password">Password admin</label>
      <input id="password" type="password" name="password" required autofocus />
      <button type="submit">Masuk</button>
    </form>
  </div>
</body>
</html>`;
}
