// Loads apps/backend/.env into process.env (built into Node, no package needed).
// index.ts imports this file FIRST, so the values exist before supabase.ts reads them.
try {
  process.loadEnvFile();
} catch {
  // no .env file: fine on Vercel, where env vars come from the dashboard
}
