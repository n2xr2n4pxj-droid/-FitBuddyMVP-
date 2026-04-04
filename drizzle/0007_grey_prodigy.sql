CREATE TABLE "exercise_sets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_exercise_id" varchar NOT NULL,
	"set_index" integer NOT NULL,
	"set_type" varchar(32),
	"target_weight" real,
	"target_reps" integer,
	"target_rpe" integer,
	"actual_weight" real,
	"actual_reps" integer,
	"is_completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"muscle_group" varchar(64),
	"equipment" varchar(64),
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "routine_exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" varchar NOT NULL,
	"exercise_id" varchar NOT NULL,
	"order" integer NOT NULL,
	"superset_id" varchar(64),
	"rest_timer_seconds" integer DEFAULT 90
);
--> statement-breakpoint
CREATE TABLE "workout_routines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"scheduled_date" timestamp with time zone,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_receiver_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "coach_client_relationships" ALTER COLUMN "coach_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "coach_client_relationships" ALTER COLUMN "client_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "coach_clients" ALTER COLUMN "coach_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "coach_clients" ALTER COLUMN "client_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "email_logs" ALTER COLUMN "coach_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "friend_requests" ALTER COLUMN "sender_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "friend_requests" ALTER COLUMN "receiver_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "friendships" ALTER COLUMN "user1_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "friendships" ALTER COLUMN "user2_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invitation_templates" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invitation_templates" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "invitation_templates" ALTER COLUMN "coach_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "sender_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "receiver_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "meals" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "progress_entries" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "workout_plans" ALTER COLUMN "coach_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "workout_plans" ALTER COLUMN "client_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_routine_exercise_id_routine_exercises_id_fk" FOREIGN KEY ("routine_exercise_id") REFERENCES "public"."routine_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_routine_id_workout_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."workout_routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_routines" ADD CONSTRAINT "workout_routines_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_routines" ADD CONSTRAINT "workout_routines_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_sets_routine_exercise_idx" ON "exercise_sets" USING btree ("routine_exercise_id");--> statement-breakpoint
CREATE INDEX "exercises_muscle_group_idx" ON "exercises" USING btree ("muscle_group");--> statement-breakpoint
CREATE INDEX "exercises_equipment_idx" ON "exercises" USING btree ("equipment");--> statement-breakpoint
CREATE INDEX "exercises_created_by_idx" ON "exercises" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "routine_exercises_routine_idx" ON "routine_exercises" USING btree ("routine_id");--> statement-breakpoint
CREATE INDEX "routine_exercises_exercise_idx" ON "routine_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "workout_routines_coach_idx" ON "workout_routines" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "workout_routines_client_idx" ON "workout_routines" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "workout_routines_scheduled_date_idx" ON "workout_routines" USING btree ("scheduled_date");--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;