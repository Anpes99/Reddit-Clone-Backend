# A full-stack Reddit-clone

![Backend tests](https://github.com/Anpes99/Reddit-Clone-Backend/actions/workflows/test.yml/badge.svg) ![Frontend tests](https://github.com/Anpes99/Reddit-Clone-Frontend/actions/workflows/test.yml/badge.svg)

### A full-stack Reddit-clone application built with React, Redux, Node.js, and PostgreSQL.

## [Live demo](https://reddit-clone-app-1234512345-fecf0e20e036.herokuapp.com/) · [Frontend Repository](https://github.com/Anpes99/Reddit-Clone-Frontend)

## Try the Live Demo

Explore the application without creating an account using the demo credentials below.

| Credential | Value |
|---|---|
| **Username** | `demo_user` |
| **Password** | `password` |

[**Open Live Demo →**](https://reddit-clone-app-1234512345-fecf0e20e036.herokuapp.com/)
















# Tech Stack
 - Frontend: React, Redux, JavaScript, Tailwind CSS, CSS, HTML
 - Backend: Node.js, Express.js, PostgreSQL, Sequelize ORM, Redis
 - Authentication & Validation: JWT, refresh-token rotation and revocation, email verification, Redis-backed API rate limiting, Joi
 - Testing: Jest, unit and PostgreSQL integration tests
 - Email Services: Brevo, Nodemailer
 - Real-time Communication: Socket.IO
 - Storage: AWS S3
 - AI & Search: Voyage AI embeddings, semantic search
 - Deployment: Heroku





## Engineering Highlights

**Semantic post search with pgvector**
Posts are embedded with Voyage AI and stored in a pgvector column with an HNSW index, so "top" search ranks by meaning rather than keywords. The query embedding is returned to the client and reused for the next pages of results, so scrolling doesn't call the embedding API again. Newest-first search uses PostgreSQL trigram similarity instead.

**Counters maintained by database triggers**
User karma, post comment counts, nested reply counts and subreddit member counts are kept in sync by PostgreSQL triggers instead of application code, so they stay correct when requests overlap. Nested reply counts use a recursive query to update every ancestor comment, and karma ignores votes on your own content.

**Refresh-token rotation with revocation**
Access tokens last 15 minutes. Each refresh token has an ID stored in Redis; refreshing deletes the old ID and issues a new token, so a stolen refresh token stops working after one use, and logging out revokes it immediately.

**Typo-tolerant subreddit search**
Subreddit search uses `pg_trgm` word similarity, so near-misses still match, ranked by similarity and then by member count.

**Real-time presence and voting**
Socket.IO pushes vote changes to every viewer instantly and tracks how many signed-in users are viewing each subreddit, dropping users who haven't been seen for 60 seconds.

**Leaderboard with history**
A scheduled job rebuilds the top-50 subreddit leaderboard every hour and keeps one snapshot per day, which is what allows the rank-change indicators to work on top communities leaderboard.

**Tested and safe to migrate**
150+ unit and integration tests run in CI against a real PostgreSQL database. The schema is built entirely from versioned migrations, with foreign keys and cascade rules that keep data consistent when users, posts or subreddits are deleted.











## Key Features

### Authentication & Security
- ✅ Password hashing
- ✅ JWT authentication and refresh-token rotation
- ✅ Refresh-token revocation using Redis to invalidate old or revoked refresh tokens, preventing their reuse and strengthening session security
- ✅ Mandatory email verification for all accounts, with expiring database-stored tokens, resend functionality, and email delivery using Brevo and Nodemailer
- ✅ Secure email-based password recovery with a dedicated password reset page and hashed, database-stored reset tokens that expire after 30 minutes
- ✅ Authentication and role-based authorization
- ✅ CSRF protection through origin validation for state-changing API methods
- ✅ Security headers using Helmet, including clickjacking protection, Content Security Policy (CSP) to restrict resource loading and prevent unauthorized framing, and production-only HSTS with a one-year max age.
- ✅ Redis-backed rate limiting for login, signup, post and comment creation, and general API requests

### Backend & Database
- ✅ Express.js REST API
- ✅ PostgreSQL with Sequelize ORM
- ✅ Joi request validation
- ✅ Versioned database migrations with Sequelize CLI, built from a single baseline schema
- ✅ Database triggers that keep vote karma, comment counts, nested reply counts and subreddit member counts in sync
- ✅ Foreign key constraints with cascade rules that protect data integrity when users, posts or subreddits are deleted

### Frontend
- ✅ Redux-based state management
- ✅ Responsive layouts for mobile and desktop

### Storage & Deployment
- ✅ AWS S3 image storage with server-side file size limits for image uploads
- ✅ Live application deployment on Heroku

### Testing
- ✅ 150+ automated tests covering unit and integration testing
- ✅ Unit tests for API routes, authentication middleware, JWT handling, CSRF protection and Joi validation rules
- ✅ Integration tests against a real PostgreSQL database for semantic vector search, typo-tolerant subreddit search, voting and karma, and trigger-maintained counters
- ✅ Isolated test database with a safety check that refuses to run if it points at the main database

```bash
# Set TEST_DATABASE_URI in .env (must differ from DATABASE_URI)
npm test
```




## User

- ✅ Login & Logout
- ✅ User registration with mandatory email verification, expiring verification tokens, and email resend functionality
- ✅ Password recovery via email with a dedicated password reset page and 30-minute expiring reset tokens
- ✅ Edit user avatar, profile page background image and introduction
- ✅ User profile page with overview, posts, and comments feed tabs


## Subreddit

- ✅ Create subreddit
- ✅ Edit subreddit icon, subreddit page background image and description  (Moderator and Owner)
- ✅ Join subreddit
- ✅ Leave subreddit
- ✅ Search for subreddits
- ✅ Subreddit page with post feed
- ✅ Real-time count of authenticated users currently viewing each subreddit using Socket.IO
- ✅ Subreddit member count leaderboard: Automatically updates daily using a scheduled cron job, with rank-change indicators showing each subreddit's movement compared to the previous day's leaderboard

## Post

- ✅ Create post
- ✅ Vote post
- ✅ Add an image to a post
- ✅ Sort post feed by new and top
- ✅ Search for posts
- ✅ Infinite scrolling for posts
- ✅ Post page with comment section
- ✅ Real-time post vote count updates using Socket.IO


## Comments

- ✅ Create comment
- ✅ Vote comment
- ✅ Real-time comment vote count updates using Socket.IO
- ✅ Nested comments


## Search

- ✅ **Semantic post search** using Voyage AI embeddings to find relevant posts based on meaning, not just keywords
- ✅ Typo-tolerant subreddit search
- ✅ Search bar with subreddit suggestions












### Homepage mobile view
<img width="233" height="411" alt="frontpage_mobile2" src="https://github.com/user-attachments/assets/37ee39c8-69e3-41c9-b505-bef79b0b862e" />























### Responsive web design
<img width="785" height="330" alt="frontpage_responsive3" src="https://github.com/user-attachments/assets/38550ff2-4667-4656-86a0-8419ff32f1c4" />


















### Subreddit creation and customization
<img width="800" height="450" alt="subreddit_creation2" src="https://github.com/user-attachments/assets/ac979222-11fa-4877-a8f9-0712b7ee2c4e" />

























### User creation and customization
<img width="800" height="450" alt="user_creation1" src="https://github.com/user-attachments/assets/d1fb21e2-8e20-403a-947e-0c4b37474838" />
















### Post creation
<img width="578" height="328" alt="post_creation6" src="https://github.com/user-attachments/assets/4395a951-ba95-48a8-8430-7e5596b078e5" />


















### Post page and nested comments
<img width="800" height="450" alt="postpage3" src="https://github.com/user-attachments/assets/154f6507-67a7-4ac2-ab38-ee17e5e6a916" />














### Search page and semantic search
<img width="355" height="638" alt="searchpage_mobile8" src="https://github.com/user-attachments/assets/c1c08007-1050-4632-9ce2-eb06f1962970" />







## Database Diagram
<img width="1698" height="870" alt="db-diagram" src="https://github.com/user-attachments/assets/08b3d44f-6c62-40bb-980c-3b8ca49d1c03" />





## Application Architecture
<img width="1206" height="816" alt="Screenshot From 2026-10-30 16-14-14" src="https://github.com/user-attachments/assets/038a3d84-a1be-458c-9ec5-4401749e41b7" />

## Local development

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

```bash
cd Reddit-Clone-Backend
cp docker.env.example docker.env
# Set VOYAGE_API_KEY (and optionally NEWS_API_KEY) in docker.env
docker compose up --build
```

This starts PostgreSQL (with pgvector), Redis and the app, runs the migrations, and serves the production build at `http://localhost:3001`. Signup verification and password reset emails are caught by Mailpit at `http://localhost:8025`. Image uploads also need S3 credentials in `docker.env`. Stop with `docker compose down` (add `-v` to also delete the database).

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

In `Reddit-Clone-Backend/.env`, set `DATABASE_URI` to your local PostgreSQL connection string (for example, `postgres://USER:PASSWORD@localhost:5432/DB_NAME`), `REDIS_URI` to your Redis URL, and provide local values for `SECRET` and `REFRESH_SECRET`. Keep `.env` private; do not commit credentials. `TEST_DATABASE_URI` is only needed for backend tests and must point to a separately created test database. The `.env.example` file lists optional credentials for email, S3 uploads, news, and search integrations; those features require their respective services and credentials.

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

### Backend tests

Create a separate PostgreSQL test database and set `TEST_DATABASE_URI` in the backend `.env` to its connection string. Never point it at your development or production database. `npm test` runs the test-database safety check, applies migrations to that database, then runs the Jest suite:

```bash
cd Reddit-Clone-Backend
npm test
```
