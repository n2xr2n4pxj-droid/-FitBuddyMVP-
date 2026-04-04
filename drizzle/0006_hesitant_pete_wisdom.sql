ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_image_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "age" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "height" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "weight" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "body_fat" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activity_level" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bmr" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tdee" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bmi" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_calories" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_protein" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_carbs" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_fat" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active" timestamp with time zone;