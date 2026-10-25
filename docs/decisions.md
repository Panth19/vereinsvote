# Design decisions

Why things are built the way they are, and when I would change them.

## One service

The Fastify server serves both the API and the built React app. That means one container, one URL, no CORS, and the session cookie stays same-site.

I'd only split them if the frontend needed a CDN, and even then a CDN in front of this one service would probably be enough.

## Postgres with Drizzle and plain SQL migrations

The rules that matter most are enforced by the database: the unique index for one vote per inbox, check constraints on dates and budgets, foreign keys, row locks. Drizzle stays close to SQL, so it's easy to see what query actually runs. Migrations are SQL files in `server/drizzle/` and run when the server starts.

With several instances starting at once, migrations should become a separate deploy step.

## Double opt-in, and only a hash of the email

A vote counts only after the link in the email is clicked. That's the cheapest way to make sure there is a real inbox behind every vote, and voters don't need an account.

The database stores an HMAC of the normalised email address, not the address. It's enough to stop a second vote, and it keeps personal data to a minimum (GDPR). The downside: we can't email voters later, for example to tell them who won. That would need its own opt-in.

## Vote counter on the project row

`projects.vote_count` goes up in the same transaction that confirms the vote. The leaderboard is the most-read data in the app, and reading a few counters is much cheaper than counting vote rows on every request. The load test checks that the counters and the vote rows still match after 2,000 parallel votes.

If one project ever gets so many votes per second that its row becomes a bottleneck, the counter could be split or updated asynchronously.

## Server-Sent Events for the live ranking

Updates only go from the server to the browser, so WebSockets would be more than needed. SSE is plain HTTP and the browser reconnects by itself. New rankings are computed at most once per second per competition, and if the stream fails the page polls every 15 seconds.

The open connections live in the server's memory. With more than one instance, a vote confirmed on one instance wouldn't reach browsers connected to another. Postgres `LISTEN/NOTIFY` would fix that without adding new infrastructure.

## Sessions in Postgres, not JWTs

The cookie holds a random token (`HttpOnly`, `SameSite=Lax`) and the database stores its SHA-256 hash. Logging out really ends the session, and a copy of the database contains no usable tokens.

The API only accepts JSON request bodies. A form on another site can't send JSON, so together with `SameSite=Lax` there's no need for CSRF tokens.

## Rate limits and proxies

Limits are per IP: 300 requests per minute overall, 20 vote starts per hour, 10 logins per minute, 10 registrations per hour. Behind Render or a load balancer the real IP is in `X-Forwarded-For`, but clients can write anything into that header. So only as many entries as there are proxies are trusted (`TRUST_PROXY_HOPS`, default 1). There's a test that tries to get around the limit with a fake header.

## Photos in Postgres

A club uploads one photo per project. The server resizes it to 1200 px, saves it as WebP and stores it in a `bytea` column. Re-encoding also removes the metadata, including the GPS position phones write into photos.

Keeping the photos in the database means no extra storage service, and backups and deletes cover them automatically. A photo at this size is usually 100 to 200 KB, which is fine for thousands of projects. With a lot more, or if photos should come from a CDN, they'd move to S3 and the table would keep only the key.

The upload sends the file itself as the request body (`Content-Type: image/jpeg`), not a multipart form. That keeps the server simple, and a form on another site can't send that content type, so the CSRF protection from above still holds. Photo URLs contain the upload time, so they can be cached forever and a new photo gets a new URL.

## German interface

Users are German clubs, sponsors and residents, so all text they see is German: the interface, error messages, validation messages and the confirmation email. Code, comments and docs stay English. There's no translation framework; with one language that would only add indirection.

## One set of validation rules

The Zod schemas in `shared/` validate every request on the server, and the frontend uses the same types. Validation errors come back with the field name and are shown next to the right input.

## Fonts from our own server

German courts have ruled that loading Google Fonts from Google's servers sends visitors' IP addresses to Google without consent. The fonts are bundled instead, and the content security policy only allows our own origin.

## Small frontend

React, React Router and plain CSS. No component library, chart library or state management library; the app is small enough that they'd cost more than they save. Pages for clubs and sponsors load separately, so voters download about 114 kB of JavaScript.
