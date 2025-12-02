CREATE TYPE "public"."activity_level" AS ENUM('SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'EXTREMELY_ACTIVE');--> statement-breakpoint
CREATE TYPE "public"."friend_request_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('LOSE_WEIGHT', 'MAINTAIN', 'GAIN_MUSCLE');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."relationship_status" AS ENUM('ACTIVE', 'PAUSED', 'TERMINATED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('USER', 'COACH', 'BOTH', 'ADMIN');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_type" text NOT NULL,
	"related_meal_id" varchar,
	"related_workout_id" varchar,
	"related_progress_id" varchar,
	"summary" text NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_client_relationships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"status" "relationship_status" DEFAULT 'ACTIVE' NOT NULL,
	"notes" text,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"status" "friend_request_status" DEFAULT 'PENDING' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" varchar NOT NULL,
	"user2_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_email" text NOT NULL,
	"receiver_id" varchar,
	"invitation_type" text NOT NULL,
	"status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
	"message" text,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"meal_type" text NOT NULL,
	"calories" real NOT NULL,
	"protein" real NOT NULL,
	"carbs" real NOT NULL,
	"fat" real NOT NULL,
	"serving_size" real,
	"serving_size_unit" varchar(10),
	"user_serving_amount" real,
	"portion" text,
	"photo" text,
	"consumed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"weight" real NOT NULL,
	"body_fat" real,
	"muscle_mass" real,
	"chest" real,
	"waist" real,
	"hips" real,
	"arms" real,
	"thighs" real,
	"notes" text,
	"photos" text,
	"mood" text,
	"energy" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'USER' NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar" text,
	"phone" text,
	"date_of_birth" timestamp with time zone,
	"email_verified" boolean DEFAULT false NOT NULL,
	"age" integer,
	"gender" "gender",
	"height" real,
	"weight" real,
	"body_fat" real,
	"activity_level" "activity_level",
	"goal" "goal_type",
	"bmr" real,
	"tdee" real,
	"bmi" real,
	"goal_calories" real,
	"goal_protein" real,
	"goal_carbs" real,
	"goal_fat" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"workout_type" text NOT NULL,
	"duration" integer NOT NULL,
	"calories_burned" real,
	"intensity" text,
	"exercises" text,
	"notes" text,
	"photos" text,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_related_meal_id_meals_id_fk" FOREIGN KEY ("related_meal_id") REFERENCES "public"."meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_related_workout_id_workouts_id_fk" FOREIGN KEY ("related_workout_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_related_progress_id_progress_entries_id_fk" FOREIGN KEY ("related_progress_id") REFERENCES "public"."progress_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_client_relationships" ADD CONSTRAINT "coach_client_relationships_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_client_relationships" ADD CONSTRAINT "coach_client_relationships_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_user_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_activity_type_idx" ON "activity_logs" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "coach_client_relationships_coach_idx" ON "coach_client_relationships" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_client_relationships_client_idx" ON "coach_client_relationships" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "coach_client_relationships_status_idx" ON "coach_client_relationships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "coach_client_relationships_unique" ON "coach_client_relationships" USING btree ("coach_id","client_id");--> statement-breakpoint
CREATE INDEX "friend_requests_sender_idx" ON "friend_requests" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "friend_requests_receiver_idx" ON "friend_requests" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "friend_requests_status_idx" ON "friend_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "friendships_user1_idx" ON "friendships" USING btree ("user1_id");--> statement-breakpoint
CREATE INDEX "friendships_user2_idx" ON "friendships" USING btree ("user2_id");--> statement-breakpoint
CREATE INDEX "friendships_unique" ON "friendships" USING btree ("user1_id","user2_id");--> statement-breakpoint
CREATE INDEX "invitations_sender_idx" ON "invitations" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "invitations_receiver_email_idx" ON "invitations" USING btree ("receiver_email");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitations_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "meals_user_idx" ON "meals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meals_consumed_at_idx" ON "meals" USING btree ("consumed_at");--> statement-breakpoint
CREATE INDEX "meals_meal_type_idx" ON "meals" USING btree ("meal_type");--> statement-breakpoint
CREATE INDEX "progress_entries_user_idx" ON "progress_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "progress_entries_recorded_at_idx" ON "progress_entries" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "workouts_user_idx" ON "workouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workouts_performed_at_idx" ON "workouts" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "workouts_workout_type_idx" ON "workouts" USING btree ("workout_type");