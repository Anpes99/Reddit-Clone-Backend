# Full-stack Reddit Clone

![Backend tests](https://github.com/Anpes99/Reddit-Clone-Backend/actions/workflows/test.yml/badge.svg) ![Frontend tests](https://github.com/Anpes99/Reddit-Clone-Frontend/actions/workflows/test.yml/badge.svg)

A Reddit-style community platform built end to end with **React, Redux Toolkit, Node.js/Express, PostgreSQL and Redis**. It has semantic post search with vector embeddings, asynchronous image moderation through a background job queue, AI moderation of third-party news content, real-time voting and presence over authenticated WebSockets, JWT auth with refresh-token rotation, and **250+ automated tests** that run in CI on both the frontend and the backend.

**[Live demo](https://reddit-clone-app-1234512345-fecf0e20e036.herokuapp.com/)** · [Frontend repository](https://github.com/Anpes99/Reddit-Clone-Frontend) · [Backend repository](https://github.com/Anpes99/Reddit-Clone-Backend)

| Demo login | |
|---|---|
| **Username** | `demo_user` |
| **Password** | `password` |

## Tech Stack

- **Frontend:** React 18, Redux Toolkit, React Router, Tailwind CSS, Material UI, Formik + Yup, Socket.IO client
- **Backend:** Node.js, Express, PostgreSQL (pgvector, pg_trgm), Sequelize ORM + migrations, Redis, BullMQ, Socket.IO, Joi, Pino
- **Auth & security:** JWT access tokens, rotating refresh tokens revoked in Redis, email verification, Helmet, CSRF origin checks, Redis-backed rate limiting
- **Integrations:** Voyage AI embeddings, Sightengine image moderation, OpenAI Moderation API, NewsAPI, AWS S3, Brevo + Nodemailer
- **Testing & tooling:** Jest, React Testing Library, PostgreSQL integration tests, GitHub Actions CI, Docker Compose, ESLint, Prettier
- **Deployment:** Heroku

## Engineering Highlights

### Backend & data

**Semantic post search with pgvector**
Posts are embedded with Voyage AI and stored in a pgvector column with an HNSW index, so "top" search ranks results by meaning rather than keywords. The query embedding is returned to the client and reused for the next pages of results, so infinite scrolling doesn't call the embedding API again. Newest-first search uses PostgreSQL trigram similarity instead.

**Counters maintained by database triggers**
User karma, post comment counts, nested reply counts and subreddit member counts are kept in sync by PostgreSQL triggers instead of application code, so they stay correct when requests overlap. Nested reply counts use a recursive query to update every ancestor comment, and karma ignores votes on your own content.

**Concurrency-safe voting**
Each vote change runs in a database transaction, and the vote row is only updated if it still holds the value that was read. Two votes arriving at the same moment can't be double-counted or leave the score out of sync.

**Typo-tolerant subreddit search**
Subreddit search uses `pg_trgm` word similarity, so near-misses still match. Results are ranked by similarity, then by member count.

**Leaderboard with history**
A scheduled job rebuilds the top-50 subreddit leaderboard every hour and keeps one snapshot per day, which powers the rank-change indicators on the top communities leaderboard.

**Asynchronous image moderation with a job queue**
Posts with images are saved as pending and stay hidden until their image has been checked, so the API responds right away instead of waiting on a third-party service. Creating the post adds a job to a Redis-backed BullMQ queue, and a worker processes up to 5 jobs at a time, sending each image to Sightengine to detect unsafe content. Failed checks are retried 3 times with exponential backoff, and a post whose check keeps failing is marked as failed and never shown. Unchecked and flagged posts are filtered out of feeds, search results, post pages, profiles and contribution counts.

**AI moderation of third-party news content**
The trending section on the home page shows headlines from NewsAPI, and every article is checked with OpenAI's multimodal `omni-moderation-latest` model before it reaches the client. The headline, description and thumbnail image are checked together in one request, and articles flagged as unsafe are dropped. Articles are moderated in parallel, verdicts are cached in Redis for 24 hours so repeat page loads don't call the API again, and if the check fails, the article is hidden.

**Centralized error handling and structured logging**
Every failure goes through a single Express error handler, so the API always answers with the same `{ code, message, details }` shape, whether it's a 404, an auth failure, a validation error, a CSRF rejection or a rate limit. Unexpected errors are logged on the server and the client only gets a generic 500, so internal details never leak. Pino logs every request, as readable output in development and JSON in production.

### Security

**Refresh-token rotation with revocation**
Access tokens last 15 minutes. Each refresh token has an ID stored in Redis. Refreshing deletes the old ID and issues a new token, so a stolen refresh token stops working after one use, and logging out revokes it immediately. The refresh token lives in an httpOnly, SameSite cookie scoped to `/api/auth`, so page scripts can't read it.

**CSRF protection and security headers**
Every state-changing request is rejected unless its `Origin` header matches the frontend's origin. Helmet sets a Content Security Policy, blocks the site from being framed to prevent clickjacking, and enables HSTS in production. Passwords are hashed with bcrypt, and moderator actions are checked against a role-to-permission map for each subreddit. Unexpected errors reach the client only as a generic 500, so stack traces and other internal details are never sent.

**Rate limiting on every entry point**
Login (30 per minute per IP), sign-up (5 per 15 minutes and 20 per day per IP), posting and commenting (5 per minute per user) are limited in Redis, so the limits hold across server instances. All API traffic also has a general limit of 300 requests per minute, and socket votes are limited as described below.

### Real-time

**Authenticated, rate-limited WebSockets**
Socket.IO connections are authenticated with the same JWT as the REST API. Voting over the socket requires a signed-in user and is rate-limited in Redis to one vote per user per post or comment every 3 seconds. Vote changes are pushed to every viewer instantly, and the app tracks how many signed-in users are viewing each subreddit, dropping users who haven't been seen for 60 seconds.

### Frontend

**Silent token refresh shared by HTTP and WebSockets**
An Axios interceptor catches expired access tokens, refreshes them once and retries the original request, and shows a notification when the user is rate limited. A Redux listener middleware watches the access token and reconnects the socket whenever it changes (login, refresh or logout), so real-time features always act as the current user.

**Direct-to-S3 image uploads**
Images are uploaded straight from the browser to S3 with presigned POST fields, with file size limits enforced on the server, so image data never passes through the API.

### Quality

**250+ tests in CI**
176 backend tests (unit tests plus integration tests against a real PostgreSQL database) and 84 frontend tests (React Testing Library) run on every push with GitHub Actions, and the backend pipeline also enforces ESLint and Prettier checks. The schema is built entirely from versioned migrations, with foreign keys and cascade rules that keep data consistent when users, posts or subreddits are deleted.

## Features

**Users**
- Sign-up with mandatory email verification (hashed, expiring tokens, with resend)
- Login and logout, plus password recovery by email with 30-minute reset links
- Profile page with overview, posts and comments tabs, and an editable avatar, background image and introduction

**Communities**
- Create, join, leave and search subreddits
- Owners and moderators can edit the icon, background image and description
- Live count of signed-in users viewing each subreddit
- Top communities leaderboard with daily rank-change indicators

**Posts & comments**
- Create posts with images, then upvote and downvote them, with scores updating live for every viewer
- Uploaded images are moderated in the background, and posts only appear once their image passes
- Feeds sorted by new or top, with infinite scrolling
- Nested comment threads with voting, replies and on-demand loading of deeper replies

**Search**
- Semantic post search that matches meaning, not just keywords
- Typo-tolerant subreddit search, with subreddit suggestions in the search bar

**News**
- Trending headlines on the home page, automatically filtered for unsafe text and images

**Responsive UI** for mobile and desktop.

## Testing

| | Tests | What's covered |
|---|---|---|
| **Backend** | 176 | API routes, auth middleware, JWT handling, CSRF protection, Joi validation, the central error handler and error response format, logout when the token can't be revoked, image moderation jobs queued on post creation and unmoderated posts hidden from post pages and profiles, socket auth and vote rate limiting, plus integration tests against PostgreSQL for vector search, trigram search, voting and karma, and trigger-maintained counters |
| **Frontend** | 84 | Sign-in, sign-up and password-reset forms, logout failure handling, the Axios token-refresh interceptor, socket reconnection on token change, post and comment voting, nested comment threads, post and comment creation, joining subreddits, Redux state and S3 uploads |

Backend tests use a separate test database and refuse to run if it points at the main database.

## Screenshots

### Homepage (mobile)
<img width="233" height="411" alt="Homepage on mobile" src="https://github.com/user-attachments/assets/37ee39c8-69e3-41c9-b505-bef79b0b862e" />

### Responsive layout
<img width="785" height="330" alt="Responsive homepage" src="https://github.com/user-attachments/assets/38550ff2-4667-4656-86a0-8419ff32f1c4" />

### Subreddit creation and customization
<img width="800" height="450" alt="Subreddit creation" src="https://github.com/user-attachments/assets/ac979222-11fa-4877-a8f9-0712b7ee2c4e" />

### User creation and customization
<img width="800" height="450" alt="User creation" src="https://github.com/user-attachments/assets/d1fb21e2-8e20-403a-947e-0c4b37474838" />

### Post creation
<img width="578" height="328" alt="Post creation" src="https://github.com/user-attachments/assets/4395a951-ba95-48a8-8430-7e5596b078e5" />

### Post page and nested comments
<img width="800" height="450" alt="Post page" src="https://github.com/user-attachments/assets/154f6507-67a7-4ac2-ab38-ee17e5e6a916" />

### Search page and semantic search
<img width="355" height="638" alt="Search page" src="https://github.com/user-attachments/assets/c1c08007-1050-4632-9ce2-eb06f1962970" />

## Architecture

<img width="1206" height="816" alt="Application architecture" src="https://github.com/user-attachments/assets/038a3d84-a1be-458c-9ec5-4401749e41b7" />

## Database Diagram

<img width="1698" height="870" alt="Database diagram" src="https://github.com/user-attachments/assets/08b3d44f-6c62-40bb-980c-3b8ca49d1c03" />

## Local Development

Clone this repository and the [frontend repository](https://github.com/Anpes99/Reddit-Clone-Frontend) into the same parent directory. Both are needed to run the app:

```
parent-directory/
  Reddit-Clone-Backend/
  Reddit-Clone-Frontend/
```

### Quick start with Docker

API keys go in a `docker.env` file in the backend repository:

- [Voyage AI](https://www.voyageai.com/) (required, free): post embeddings for semantic search. Without this key, creating posts and searching posts sorted by "Top" fail. Searching by "New" still works.
- [NewsAPI](https://newsapi.org/) (optional, free): only used for the small news section below the header on the home page.
- [OpenAI](https://platform.openai.com/) (optional, the Moderation API is free): moderates the news section. Without this key, moderation fails closed and no news articles are shown.
- [Sightengine](https://sightengine.com/) (optional, free tier): moderates images in new posts. Without these keys, image moderation fails closed and posts with images are never shown. Posts without images aren't affected.

```bash
cd Reddit-Clone-Backend
cp docker.env.example docker.env
# Set VOYAGE_API_KEY (and optionally NEWS_API_KEY, OPENAI_API_KEY, SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET) in docker.env
docker compose up --build
```

This starts PostgreSQL (with pgvector), Redis and the app (including the image moderation worker), runs the migrations, and serves the production build at `http://localhost:3001`. Sign-up verification and password reset emails are caught by Mailpit at `http://localhost:8025`. Image uploads also need S3 credentials in `docker.env`. Stop with `docker compose down` (add `-v` to also delete the database).

To fill the app with demo users, communities, posts, comments and votes, run this while it's up:

```bash
docker compose exec app npm run seed
```

Every demo user (`demo_user1` to `demo_user6`) logs in with the password `password`.

### Manual setup

#### Prerequisites

- Node.js and npm
- PostgreSQL with the `vector` and `pg_trgm` extensions available
- Redis

From the parent directory, create a local PostgreSQL database, then configure the backend:

```bash
cd Reddit-Clone-Backend
cp .env.example .env
```

In `Reddit-Clone-Backend/.env`, set `DATABASE_URI` to your local PostgreSQL connection string (for example, `postgres://USER:PASSWORD@localhost:5432/DB_NAME`), `REDIS_URI` to your Redis URL, and provide local values for `SECRET` and `REFRESH_SECRET`. Keep `.env` private; do not commit credentials. `TEST_DATABASE_URI` is only needed for backend tests and must point to a separately created test database. The `.env.example` file lists optional credentials for email, S3 uploads, news, image moderation, and search integrations; those features require their respective services and credentials.

Install dependencies, migrate the development database, and start the API:

```bash
cd Reddit-Clone-Backend
npm ci
npm run db:migrate:dev
npm run dev
```

In a second terminal, start the frontend:

```bash
cd Reddit-Clone-Frontend
npm ci
npm start
```

The frontend runs at `http://localhost:3000` and proxies API requests to the backend at `http://localhost:3001`.

### Running the tests

**Backend:** create a separate PostgreSQL test database and set `TEST_DATABASE_URI` in the backend `.env` to its connection string. Never point it at your development or production database. `npm test` runs the test-database safety check, applies migrations to that database, then runs the Jest suite:

```bash
cd Reddit-Clone-Backend
npm test
```

**Frontend:** no database or running backend needed:

```bash
cd Reddit-Clone-Frontend
npm test
```
