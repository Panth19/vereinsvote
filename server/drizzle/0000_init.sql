CREATE TYPE "public"."category" AS ENUM('sport', 'youth', 'culture', 'environment', 'social', 'education');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'club');--> statement-breakpoint
CREATE TYPE "public"."vote_status" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"sponsor_name" text NOT NULL,
	"region" text NOT NULL,
	"budget_cents" integer NOT NULL,
	"prize_shares" jsonb NOT NULL,
	"submission_starts_at" timestamp with time zone NOT NULL,
	"voting_starts_at" timestamp with time zone NOT NULL,
	"voting_ends_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "competitions_dates_ordered" CHECK ("competitions"."submission_starts_at" < "competitions"."voting_starts_at" AND "competitions"."voting_starts_at" < "competitions"."voting_ends_at"),
	CONSTRAINT "competitions_budget_positive" CHECK ("competitions"."budget_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "project_photos" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"category" "category" NOT NULL,
	"funding_goal_cents" integer NOT NULL,
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"moderated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"email_hash" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" "vote_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "votes_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_club_id_users_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_one_per_club" ON "projects" USING btree ("competition_id","club_id");--> statement-breakpoint
CREATE INDEX "projects_competition_status_idx" ON "projects" USING btree ("competition_id","status");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_one_per_email" ON "votes" USING btree ("competition_id","email_hash");--> statement-breakpoint
CREATE INDEX "votes_project_idx" ON "votes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "votes_competition_confirmed_idx" ON "votes" USING btree ("competition_id","confirmed_at");