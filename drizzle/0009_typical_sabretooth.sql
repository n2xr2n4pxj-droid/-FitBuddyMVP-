CREATE TABLE "session_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"trainer_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_feedbacks" ADD CONSTRAINT "session_feedbacks_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_feedbacks" ADD CONSTRAINT "session_feedbacks_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_feedbacks_session_idx" ON "session_feedbacks" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_feedbacks_session_trainer_unique" ON "session_feedbacks" USING btree ("session_id","trainer_id");