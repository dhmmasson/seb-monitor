/**
 * HTML layout shell — wraps all dashboard pages.
 * Server-side rendered, minimal embedded CSS.
 */

export function renderLayout(title: string, content: string, basePath = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; padding: 1rem; }
    nav { background: #1a1a2e; color: white; padding: 1rem; margin-bottom: 1.5rem; }
    nav a { color: white; text-decoration: none; font-weight: 600; }
    nav a:hover { text-decoration: underline; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
    tr:hover { background: #f8f9fa; }
    .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
    .badge-good { background: #d4edda; color: #155724; }
    .badge-warn { background: #fff3cd; color: #856404; }
    .badge-bad { background: #f8d7da; color: #721c24; }
    a { color: #0d6efd; }
    .empty-state { text-align: center; padding: 3rem; color: #666; }
    .error-message { background: #f8d7da; color: #721c24; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; }
    .btn { display: inline-block; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    .btn-primary { background: #0d6efd; color: white; }
    .btn-primary:hover { background: #0b5ed7; }
    .card { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem; }
    .metric { text-align: center; }
    .metric-value { font-size: 2rem; font-weight: 700; }
    .metric-label { font-size: 0.85rem; color: #666; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .paste-expand { cursor: pointer; color: #0d6efd; }
    .paste-content { background: #f8f9fa; padding: 1rem; border-radius: 4px; margin-top: 0.5rem; font-family: monospace; white-space: pre-wrap; display: none; }
    .paste-content.show { display: block; }
    .highlight-unmatched { background: #fff3cd; }
    .sortable { cursor: pointer; user-select: none; white-space: nowrap; }
    .sortable:hover { background: #e9ecef; }
  </style>
</head>
<body>
  <nav>
    <div class="container">
      <a href="${basePath}/dashboard">📊 SEB Monitor — Dashboard</a>
    </div>
  </nav>
  <div class="container">
    ${content}
  </div>
</body>
</html>`;
}
