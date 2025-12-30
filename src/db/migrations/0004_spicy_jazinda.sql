CREATE TABLE "projection_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"inputs" jsonb NOT NULL,
	"assumptions" jsonb NOT NULL,
	"records" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"calculation_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projection_results_plan_id_unique" UNIQUE("plan_id")
);
--> statement-breakpoint
ALTER TABLE "projection_results" ADD CONSTRAINT "projection_results_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_results" ADD CONSTRAINT "projection_results_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Enable Row-Level Security
ALTER TABLE "projection_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- RLS Policy: Users can only access their own projection results
CREATE POLICY "Users can only access their own projection results"
  ON "projection_results"
  FOR ALL
  USING (auth.uid() = user_id);--> statement-breakpoint

-- Create indexes for performance
CREATE INDEX "idx_projection_results_user_id" ON "projection_results"(user_id);--> statement-breakpoint
CREATE INDEX "idx_projection_results_plan_id" ON "projection_results"(plan_id);--> statement-breakpoint

-- Apply updated_at trigger
CREATE TRIGGER update_projection_results_updated_at
  BEFORE UPDATE ON "projection_results"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();