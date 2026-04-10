# Smart Files

Next.js file manager with per-user storage, chunked uploads (pause/resume), HTTP Range downloads, and Docker Compose deployment.

## Features

- Email + password registration and sign-in (Auth.js, JWT sessions).
- Uploads split into configurable chunks; **pause** and pick the **same file** again to **resume** (session id is stored in `sessionStorage`).
- Downloads support **`Range`** requests for resumable downloads.
- Metadata in **PostgreSQL** (Prisma); blobs on disk under `UPLOAD_ROOT`.

## Local development

1. Copy environment and start Postgres (or use Docker only for the database):

   ```bash
   cp .env.example .env
   # Edit AUTH_SECRET and DATABASE_URL if needed
   ```

2. Install dependencies and apply migrations:

   ```bash
   npm install
   npx prisma migrate deploy
   # or during early schema iteration: npx prisma db push
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000), register an account, then open **Your files** at `/files`.

## Docker Compose

From the project root:

```bash
export AUTH_SECRET="$(openssl rand -base64 32)"
docker compose up --build
```

- App: [http://localhost:3000](http://localhost:3000)
- On first start the container runs `prisma migrate deploy` then `node server.js`.
- Uploads persist in the `upload_data` volume; Postgres data in `postgres_data`.

Override the public URL if you publish behind another host:

```bash
AUTH_URL=https://files.example.com docker compose up --build
```

## API summary

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/register` | Register `{ email, password, name? }` |
| POST | `/api/upload/session` | Start upload `{ fileName, totalSize, chunkSize? }` |
| GET | `/api/upload/session/[uploadId]` | Resume: list received chunk indexes |
| PUT | `/api/upload/session/[uploadId]/chunk?index=n` | Upload one chunk (raw body) |
| POST | `/api/upload/session/[uploadId]/complete` | Merge chunks, create file record |
| GET | `/api/files` | List current user’s files |
| DELETE | `/api/files/[id]` | Delete file |
| GET | `/api/files/[id]/download` | Download (supports `Range`) |

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret for Auth.js (required in production) |
| `AUTH_URL` | Origin of the app (e.g. `http://localhost:3000`) |
| `UPLOAD_ROOT` | Directory for `tmp/` and `files/` (default `./data/storage`) |
| `MAX_FILE_SIZE_BYTES` | Max upload size (default 500 MiB) |
| `DEFAULT_CHUNK_SIZE_BYTES` | Server default chunk size (256 KiB–32 MiB) |
| `MAX_CHUNKS` | Safety cap on chunk count (default 50000) |

## Notes

- Horizontal scaling would require shared storage for `UPLOAD_ROOT` (or object storage) so all app instances see the same chunks and files.
- The default deployment is a single app replica with named volumes, which matches `docker-compose.yml`.
