CREATE TABLE "user_notification_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"owned_name_expiry" boolean DEFAULT false NOT NULL,
	"favourited_name_expiry" boolean DEFAULT false NOT NULL,
	"ens_labs_updates" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "notification_preferences" CASCADE;--> statement-breakpoint
ALTER TABLE "ens_watchers" ADD COLUMN "watch_reason" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;