# DockerBackendPortfolio

## Description
This is the backend for the website, able to run as a docker container.
The database contains 3 tables: projects, journals and articles. Projects and articles can each have one cover image; articles are long-form posts written in Markdown.
Images are stored as files in an uploads folder (a Docker volume); the database only stores their file names.
The sql is ran by postgresql and is connected through the pg module into the node server.
This backend is made only with basic checks for input confirmation and CRUD activities.

## Endpoints
## GET
### / 
Returns AI 404 page
### /projects
Returns all projects as rows
### /journals
Returns all journals as rows
### /journals/top5
Returns the top 5 of the rows
### /projects/top5
Returns the top 5 of the rows
### /test
Non-SQL test to see if the server is online.
### /articles/next/:offset
Returns the next 5 **published** articles (no content, for lists)
### /article/:id
Returns one **published** article with its full Markdown content (404 for drafts)
### /articles/all (auth)
Returns every article including drafts, with content (for the dashboard)
### /images (auth)
Lists uploaded images, newest first
### /uploads/:filename
Serves an uploaded image. The frontend uses `/api/uploads/<filename>`
## POST
### /project
Takes title and content (and optional cover_image) in json format in the req.body adds new data to database
### /journal
Takes project_id and test to make sure that project_id exist, title, and content. Adds new row to database
### /article (auth)
Takes title, content (Markdown), and optional summary, cover_image, published (default false). Returns the new id
### /image (auth)
multipart/form-data with one file in the `image` field. JPEG, PNG, GIF or WebP, up to 10 MB. Returns `{ filename }`
## DELETE
### /journal/:id
Deletes the journal with the given id
### /project/:id
Deletes the project with the given id and cascades all journals with it
### /article/:id (auth)
Deletes the article
### /image/:filename (auth)
Deletes the image file, unless a project or article still uses it (409)
## PATCH 
### /journal/title/:id
Update the title of journal with id
### /journal/content/:id
Update the content of the journal with id
### /project/title/:id
Update the title of project with id
### /project/content/:id
Update the content of the project with id
### /project/end/:id
Send a SQL query to set the end date to the current time of a project
### /journal/:id and /project/:id
Update the whole entry. For projects, `cover_image` is optional: leave it out to keep the current image, send `null` to remove it
### /article/:id (auth)
Update only the fields sent (title, summary, content, cover_image, published). The first time an article is published, date_published is set

## Authentication
Logins use [Passport](https://www.passportjs.org/) (username + password) with sessions stored in Postgres. The browser gets an HttpOnly, SameSite=Strict cookie (`portfolio.sid`); page scripts can't read it and other sites can't send it.

- Accounts live in the `users` table with a role: `admin` (can change site content) or `user` (for future features; can't change anything).
- Every create/update/delete route requires an **admin** session (`requireAdmin` in `src/auth.js`). `requireAuth` exists for future logged-in-user features.
- Registration (`POST /auth/register`) is **off** unless `ALLOW_REGISTRATION=true`. New accounts are always `user`.

### Create or reset the admin account
```bash
docker compose exec app node scripts/create-admin.js
```
Asks for a username and password (12+ characters, hidden while typing). Running it again for the same username resets the password and logs out that account's existing sessions.

### Settings (.env, see .env.example)
- `SESSION_SECRET`: required, `openssl rand -hex 32`
- `COOKIE_SECURE=true` in production. The cookie is then only sent over HTTPS, which requires the proxy to forward the protocol, e.g. in nginx:
  ```nginx
  proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;   # from cloudflared
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  ```
  If login answers 200 but you're immediately logged out, this header is missing (the server logs a warning).
- `ALLOW_REGISTRATION=false`
- `TRUST_PROXY`: optional; by default proxies on private addresses (nginx, cloudflared on the same machine) are trusted, so rate limits apply per visitor instead of to everyone at once.

### Endpoints
- `POST /auth/login` `{ username, password }` → `{ id, username, role }` and the session cookie (3 attempts / 15 min per IP)
- `POST /auth/logout`
- `GET /auth/me` → `{ id, username, role }`, 401 if not logged in
- `POST /auth/register` `{ username, password }` → 403 while registration is closed

## Database changes (migrations)
On startup the server applies any file in `src/queries/migrations/` that it hasn't applied before, in filename order, and records it in the `schema_migrations` table. Existing rows are not touched.
To change the schema: add a new numbered file (e.g. `003_something.sql`). Never edit one that has already run.

## Uploads volume
`docker-compose.yml` mounts a `portfolio-uploads` volume at `/usr/src/app/uploads` so images survive rebuilds. Back it up together with the database.

## Local testing
```bash
docker compose up -d --build
# Optional sample projects, journals and articles. LOCAL ONLY, never on the live server:
docker compose exec -T db psql -U chorton -d portfolio < scripts/dev-seed.sql
```
