CREATE TABLE "email_logs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"success" boolean NOT NULL,
	"error" text,
	"error_code" text,
	"error_details" text,
	"sendgrid_response" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_logs_type_idx" ON "email_logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "email_logs_to_idx" ON "email_logs" USING btree ("to");--> statement-breakpoint
CREATE INDEX "email_logs_timestamp_idx" ON "email_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "email_logs_success_idx" ON "email_logs" USING btree ("success");--> statement-breakpoint
CREATE INDEX "email_logs_error_code_idx" ON "email_logs" USING btree ("error_code");