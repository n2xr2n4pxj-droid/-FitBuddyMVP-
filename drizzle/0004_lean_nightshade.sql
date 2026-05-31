CREATE TABLE "invitation_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"coach_id" integer NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
DROP INDEX "email_logs_to_idx";--> statement-breakpoint
DROP INDEX "email_logs_timestamp_idx";--> statement-breakpoint
DROP INDEX "email_logs_success_idx";--> statement-breakpoint
DROP INDEX "email_logs_error_code_idx";--> statement-breakpoint
DROP INDEX "users_username_idx";--> statement-breakpoint
-- ✅ 修復：所有 ID 欄位都已經是 integer 類型，不需要轉換
-- 以下語句已移除，因為相關欄位都已經是 integer 類型：
-- ALTER TABLE "activity_logs" ALTER COLUMN "user_id" SET DATA TYPE integer;
-- ALTER TABLE "coach_client_relationships" ALTER COLUMN "coach_id" SET DATA TYPE integer;
-- ALTER TABLE "coach_client_relationships" ALTER COLUMN "client_id" SET DATA TYPE integer;
-- ALTER TABLE "coach_clients" ALTER COLUMN "coach_id" SET DATA TYPE integer;
-- ALTER TABLE "coach_clients" ALTER COLUMN "client_id" SET DATA TYPE integer;
-- ALTER TABLE "friend_requests" ALTER COLUMN "sender_id" SET DATA TYPE integer;
-- ALTER TABLE "friend_requests" ALTER COLUMN "receiver_id" SET DATA TYPE integer;
-- ALTER TABLE "friendships" ALTER COLUMN "user1_id" SET DATA TYPE integer;
-- ALTER TABLE "friendships" ALTER COLUMN "user2_id" SET DATA TYPE integer;
-- ALTER TABLE "invitations" ALTER COLUMN "sender_id" SET DATA TYPE integer;
-- ALTER TABLE "invitations" ALTER COLUMN "receiver_id" SET DATA TYPE integer;
-- ALTER TABLE "meals" ALTER COLUMN "user_id" SET DATA TYPE integer;
-- ALTER TABLE "progress_entries" ALTER COLUMN "user_id" SET DATA TYPE integer;
-- ALTER TABLE "workout_plans" ALTER COLUMN "coach_id" SET DATA TYPE integer;
-- ALTER TABLE "workout_plans" ALTER COLUMN "client_id" SET DATA TYPE integer;
-- ALTER TABLE "workouts" ALTER COLUMN "user_id" SET DATA TYPE integer;
ALTER TABLE "email_logs" ALTER COLUMN "type" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "email_logs" ALTER COLUMN "type" SET DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "email_logs" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ALTER COLUMN "subject" SET DATA TYPE varchar;--> statement-breakpoint
-- ✅ 修復：users.id 已經是 integer 類型且有 sequence，不需要轉換為 serial
-- ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
-- ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "coach_id" integer;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "recipient_email" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "message_id" varchar;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "status" varchar DEFAULT 'sent' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "sent_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_expires" integer;--> statement-breakpoint
ALTER TABLE "invitation_templates" ADD CONSTRAINT "invitation_templates_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_coach_template_name" ON "invitation_templates" USING btree ("coach_id","name");--> statement-breakpoint
CREATE INDEX "email_logs_recipient_email_idx" ON "email_logs" USING btree ("recipient_email");--> statement-breakpoint
CREATE INDEX "email_logs_sent_at_idx" ON "email_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "email_logs_status_idx" ON "email_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_logs_coach_id_idx" ON "email_logs" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "email_logs_message_id_idx" ON "email_logs" USING btree ("message_id");--> statement-breakpoint
ALTER TABLE "email_logs" DROP COLUMN "to";--> statement-breakpoint
ALTER TABLE "email_logs" DROP COLUMN "success";--> statement-breakpoint
ALTER TABLE "email_logs" DROP COLUMN "error";--> statement-breakpoint
ALTER TABLE "email_logs" DROP COLUMN "error_code";--> statement-breakpoint
ALTER TABLE "email_logs" DROP COLUMN "error_details";--> statement-breakpoint
ALTER TABLE "email_logs" DROP COLUMN "sendgrid_response";--> statement-breakpoint
ALTER TABLE "email_logs" DROP COLUMN "timestamp";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "username";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "date_of_birth";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "age";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "gender";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "height";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "weight";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "body_fat";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "activity_level";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "goal";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "bmr";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "tdee";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "bmi";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "goal_calories";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "goal_protein";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "goal_carbs";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "goal_fat";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "last_active";