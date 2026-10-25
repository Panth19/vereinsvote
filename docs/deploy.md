# Deployment

The app is one Docker image plus a PostgreSQL database.

## Settings

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. Hosted databases usually need `?sslmode=require` at the end |
| `APP_SECRET` | yes | Long random string. Voter emails are hashed with it, so don't change it after launch or people could vote again |
| `APP_URL` | yes | Public URL, used in confirmation emails, e.g. `https://vereinsvote.onrender.com` |
| `SMTP_URL` | no | e.g. `smtps://user:pass@smtp.example.com:465`. Without it the app runs in demo mode and shows confirmation links on screen |
| `MAIL_FROM` | no | Sender address for confirmation emails |
| `SEED_DEMO_DATA` | no | `true` fills an empty database with demo data on first start |
| `VOTE_RATE_LIMIT_PER_HOUR` | no | Vote starts per IP per hour, default 20 |
| `RATE_LIMIT_PER_MINUTE` | no | All requests per IP per minute, default 300 |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | no | Login attempts per IP per minute, default 10 |
| `TRUST_PROXY_HOPS` | no | Number of proxies in front of the app, default 1. Use 0 if nothing is in front of it |

Create a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Migrations run automatically on startup.

For demo photos, put image files into `server/seed-photos` before building the image (the folder's README lists the names). They're used when the demo data is created.

## Render

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and pick the repository. `render.yaml` creates the web service and the database.
3. When Render asks for `APP_URL`, enter the service URL (you can change it after the first deploy).
4. Open the URL. The first start creates demo data.

Check Render's current pricing page before relying on the free plans: free web services sleep when idle (the first visit then takes a while), and free databases expire after a limited time.

## Other container hosts with Neon

1. Create a free Postgres database on [Neon](https://neon.tech) and copy its connection string.
2. Deploy the Docker image to a host such as Render (as a plain web service), Fly.io or Railway, and set the variables above.

## AWS

The image runs unchanged on AWS:

- **App Runner:** push the image to ECR, create an App Runner service on port 3000 with health check path `/api/health`, and set the variables.
- **Database:** RDS for PostgreSQL. App Runner needs a VPC connector to reach a database in a private subnet.
- A single Lightsail instance with `docker compose up -d` is the cheapest route for a demo.

Check the current AWS free-tier terms before you start. Several of these services cost money after the free period.

## Real emails

Any SMTP provider works. EU-based options such as Brevo or Mailjet keep the data in the EU. Set up SPF and DKIM for the sending domain, or confirmation emails will land in spam.

## Running more than one instance

Everything works with several instances except the live ranking push: it only reaches browsers connected to the instance that confirmed the vote. Browsers connected to other instances see the new numbers only after a reload. See decision 5 in [decisions.md](decisions.md).
