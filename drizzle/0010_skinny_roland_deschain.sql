CREATE TABLE "plan_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" varchar NOT NULL,
	"learner_id" varchar NOT NULL,
	"trainer_id" varchar NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_routine_id_workout_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."workout_routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "routine_learner_idx" ON "plan_assignments" USING btree ("routine_id","learner_id");