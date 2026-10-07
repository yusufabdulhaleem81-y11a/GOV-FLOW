# Deployment checklist

1. Create a Supabase project. From **Project Settings → API**, copy the project URL,
   anon key, and service-role key. Keep the service-role key private.
2. Apply the database schema from a trusted local terminal: set `DATABASE_URL` to
   the Supabase **Session pooler** URI and run `npm run db:migrate` from the repo root.
   Optionally seed demo data with `npm run db:seed`.
3. Create a Render web service from the repository's `render.yaml`. The Blueprint
   builds and starts the API and checks `/api/v1/health`.
4. In Render, fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY`. The API's CORS setting is named `WEB_ORIGIN`,
   not `CORS_ORIGIN`; set it after creating the Netlify site in the next step.
5. Create a Netlify site from the repository. The `netlify.toml` builds and
   publishes the SPA. In the site's environment variables, set
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase, and set
   `VITE_API_URL` to the Render service URL with `/api/v1` appended, for example
   `https://your-api.onrender.com/api/v1`. Set Render's `WEB_ORIGIN` to this
   Netlify site's exact origin, then trigger deploys after setting the variables.
6. In Supabase **Authentication → URL Configuration**, set **Site URL** to the
   Netlify site origin and add the Netlify auth callback/redirect URLs used by
   the app (including `https://your-site.netlify.app/**` and the local
   development URL if needed).
7. In GitHub repository **Settings → Secrets and variables → Actions**, add
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The hourly workflow at
   `.github/workflows/scan.yml` will then run the deadline scan; use
   **Actions → Deadline scan → Run workflow** to trigger it manually.
