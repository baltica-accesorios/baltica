CREATE TABLE "customer_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"order_number" text,
	"body" text NOT NULL,
	"handled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "wholesale_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "wholesale_note" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "reset_token" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "reset_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "customers" SET "wholesale_status" = 'aprobado' WHERE "wholesale" = true;
