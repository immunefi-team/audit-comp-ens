ALTER TABLE "notification_deliveries" ADD COLUMN "failure_category" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "dlq_attempts" integer DEFAULT 0;