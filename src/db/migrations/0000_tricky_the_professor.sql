CREATE TABLE "financial_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"birth_year" integer NOT NULL,
	"target_retirement_age" integer NOT NULL,
	"filing_status" text NOT NULL,
	"annual_income" numeric(12, 2) NOT NULL,
	"savings_rate" numeric(5, 2) NOT NULL,
	"risk_tolerance" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"birth_year" text,
	"filing_status" text,
	CONSTRAINT "user_profile_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_snapshot" ADD CONSTRAINT "financial_snapshot_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Enable Row-Level Security
ALTER TABLE "user_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_snapshot" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- RLS Policy: Users can only access their own profile
CREATE POLICY "Users can only access their own profile"
  ON "user_profile"
  FOR ALL
  USING (auth.uid() = id);--> statement-breakpoint

-- RLS Policy: Users can only access their own financial data
CREATE POLICY "Users can only access their own financial data"
  ON "financial_snapshot"
  FOR ALL
  USING (auth.uid() = user_id);--> statement-breakpoint

-- RLS Policy: Users can only access their own plans
CREATE POLICY "Users can only access their own plans"
  ON "plans"
  FOR ALL
  USING (auth.uid() = user_id);--> statement-breakpoint

-- Create indexes for performance
CREATE INDEX "idx_financial_snapshot_user_id" ON "financial_snapshot"(user_id);--> statement-breakpoint
CREATE INDEX "idx_plans_user_id" ON "plans"(user_id);--> statement-breakpoint
CREATE INDEX "idx_user_profile_email" ON "user_profile"(email);--> statement-breakpoint

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Apply updated_at triggers
CREATE TRIGGER update_user_profile_updated_at
  BEFORE UPDATE ON "user_profile"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

CREATE TRIGGER update_financial_snapshot_updated_at
  BEFORE UPDATE ON "financial_snapshot"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON "plans"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();