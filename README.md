# Association Member ID Portal

Standalone landing page + registration form for generating association member IDs.

**Stack:** Next.js 15 · Convex · Clerk

---

## Features

- Public registration form with automatic network member ID generation
- Verify ID page at `/verify` — look up registration by network or association member ID
- Admin dashboard at `/admin` (Clerk sign-in) with full CRUD for admins
- Viewer role — read-only access to overview, members, and associations
- Analytics: totals, daily chart, breakdown by association and state
- Member registry with search, filters, and CSV export
- Generated ID format: `{ASSOC3}-{STATE3}-{NIN6}`  
  Example: `NAC-LAG-123456`

---

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

On first run, Convex prompts you to create a project. Then seed associations:

```bash
npx convex run associations:seed
```

Open [http://localhost:3002](http://localhost:3002)

---

## Clerk setup (admin login)

1. Create an app at [Clerk Dashboard](https://dashboard.clerk.com)
2. Add to `.env.local`:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```
3. In Clerk → **JWT Templates**, create a template named **`convex`** (use Clerk's Convex preset)
4. In Convex dashboard → **Settings → Environment Variables**, add:
   ```env
   CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev
   ADMIN_EMAILS=you@example.com,admin@example.com
   VIEWER_EMAILS=viewer@example.com
   ```
   (`CLERK_JWT_ISSUER_DOMAIN` is the Issuer URL from the JWT template)

5. Visit [http://localhost:3002/admin](http://localhost:3002/admin) and sign in with an admin email

### Clerk webhook (sync users to Convex)

1. In Clerk → **Webhooks** → **Add Endpoint**
2. Set URL to `https://<your-deployment>.convex.site/clerk-users-webhook`  
   (use the `.convex.site` URL from your Convex dashboard, e.g. `https://affable-oriole-73.convex.site/clerk-users-webhook`)
3. Subscribe to **user** events (`user.created`, `user.updated`, `user.deleted`)
4. Copy the **Signing Secret** (`whsec_...`)
5. In **Convex dashboard** → **Settings → Environment Variables**, add:
   ```env
   CLERK_WEBHOOK_SECRET=whsec_...
   ```
6. Ensure `convex/http.ts` is deployed — run `npx convex dev` (or `npx convex deploy`) and watch for bundler errors
7. In Clerk/Svix, **Replay** any failed webhook deliveries after deploy succeeds

---

## Portal roles

| Role | Env var | Access |
|------|---------|--------|
| **Admin** | `ADMIN_EMAILS` | Overview, members, associations — full CRUD |
| **Viewer** | `VIEWER_EMAILS` | Overview, members, associations — read-only (no add/edit) |

---

## Admin dashboard

| Route | Description |
|-------|-------------|
| `/admin` | Overview — stats, charts, recent registrations |
| `/admin/members` | Searchable member table with filters and CSV export |
| `/admin/associations` | View associations (admins can also add logos) |

Emails in `ADMIN_EMAILS` or `VIEWER_EMAILS` (Convex env) can access the portal.

---

## Project structure

```
app/
  admin/              # Clerk-protected admin UI
  sign-in/            # Clerk sign-in page
components/
  admin/              # Dashboard charts, member table
  RegistrationForm.tsx
convex/
  admin.ts            # Protected analytics + member queries
  auth.config.ts      # Clerk ↔ Convex auth
  associations.ts
  members.ts
  adminAuth.ts        # Admin + viewer email allowlists
```

---

## Deploy

### Vercel (Next.js frontend)

1. Import the repo in Vercel
2. **Framework Preset:** Next.js
3. **Output Directory:** leave **empty** (do not set `public` — that causes the build error)
4. **Build Command:** `npm run build` (default)
5. Add environment variables in Vercel:
   ```env
   NEXT_PUBLIC_CONVEX_URL=...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
   CLERK_SECRET_KEY=...
   ```

### Convex (backend)

1. `npx convex deploy`
2. Set on Convex production: `ADMIN_EMAILS`, `VIEWER_EMAILS`, `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SECRET`
