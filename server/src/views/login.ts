/**
 * Login page — simple password form.
 * Server-side rendered inside the layout shell.
 */
import { renderLayout } from "./layout.ts";
import { escapeHtml } from "./utils.ts";

export function renderLoginPage(error?: string): string {
  const errorHtml = error
    ? `<div class="error-message">${escapeHtml(error)}</div>`
    : "";

  const content = `
    <div class="card" style="max-width: 400px; margin: 4rem auto;">
      <h2 style="margin-bottom: 1rem;">🔐 Dashboard Login</h2>
      ${errorHtml}
      <form method="POST" action="">
        <div style="margin-bottom: 1rem;">
          <label for="password" style="display: block; margin-bottom: 0.3rem; font-weight: 600;">Password</label>
          <input type="password" id="password" name="password" required
                 style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Login</button>
      </form>
    </div>`;

  return renderLayout("Login — SEB Monitor", content);
}
