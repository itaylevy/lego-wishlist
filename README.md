# Ariel's LEGO Wishlist

A small family wishlist for tracking LEGO sets Ariel owns and the sets he wants most. It includes exact set-number search and a password-protected managing panel.

## Local setup

Requirements: Node.js 22+ and pnpm 10+.

1. Copy `.env.example` to `.env.local`.
2. Create a PostgreSQL database (a Neon database from the Vercel Marketplace works well) and set `DATABASE_URL`.
3. Create a free Rebrickable account, generate an API key at <https://rebrickable.com/api/>, and set `REBRICKABLE_API_KEY`.
4. Choose `ADMIN_PASSWORD` and generate `SESSION_SECRET` with `openssl rand -hex 32`.
5. Run `pnpm dev`, then open <http://localhost:3000>.

The app creates its `lego_sets` table automatically on the first database request.

## Deploy to Vercel

1. Push this folder to a Git repository.
2. Import the repository at <https://vercel.com/new>.
3. Create/connect a Neon PostgreSQL database in the project's **Storage** tab.
4. Add `REBRICKABLE_API_KEY`, `ADMIN_PASSWORD`, and `SESSION_SECRET` under **Settings → Environment Variables**.
5. Redeploy, open `/admin`, and add sets by their LEGO set number.

Use the managing panel to move sets between lists, reorder the wishlist, or delete entries. Each set links to the Israeli LEGO search page, while metadata and the main catalog image are retrieved through Rebrickable's documented API.

## Commands

- `pnpm dev` — local development
- `pnpm lint` — lint the project
- `pnpm build` — production build

LEGO® is a trademark of the LEGO Group. This unofficial family project is not sponsored, authorized, or endorsed by the LEGO Group.
