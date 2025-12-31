CREATE TABLE "ai_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projection_result_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"sections" jsonb NOT NULL,
	"model" varchar(50) NOT NULL,
	"tokens_used" integer,
	"generation_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_summaries_projection_result_id_input_hash_unique" UNIQUE("projection_result_id","input_hash")
);
--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_projection_result_id_projection_results_id_fk" FOREIGN KEY ("projection_result_id") REFERENCES "public"."projection_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;