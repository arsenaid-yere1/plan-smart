ALTER TABLE "user_profile" ADD COLUMN "verification_token" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "verification_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "password_reset_token" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "password_reset_token_expires_at" timestamp;