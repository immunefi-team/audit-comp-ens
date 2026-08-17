CREATE EXTENSION IF NOT EXISTS pg_uuidv7;
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"address" text NOT NULL,
	CONSTRAINT "users_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "ens_eval_pointers" (
	"name" text PRIMARY KEY NOT NULL,
	"next_eval_at" timestamp with time zone NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ens_names" (
	"name" text PRIMARY KEY NOT NULL,
	"expiry_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ens_watchers" (
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "ens_watchers_user_id_name_pk" PRIMARY KEY("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"name" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_name_pk" PRIMARY KEY("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts_seen" (
	"user_id" uuid NOT NULL,
	"broadcast_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "broadcasts_seen_user_id_broadcast_id_pk" PRIMARY KEY("user_id","broadcast_id")
);
--> statement-breakpoint
CREATE TABLE "channel_verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"target" text,
	"purpose" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"target" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0,
	"provider_msg_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"extra_config" jsonb,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "notification_preference_unique" UNIQUE("user_id","kind","channel")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	CONSTRAINT "notifications_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "user_channels" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"target" text,
	"data" jsonb,
	"verified_at" timestamp with time zone,
	"status" text NOT NULL,
	"status_reason" text,
	"last_sent_at" timestamp with time zone,
	"last_bounce_at" timestamp with time zone,
	"last_verification_sent_at" timestamp with time zone,
	"verification_attempts" integer DEFAULT 0,
	CONSTRAINT "user_channel_unique" UNIQUE("user_id","channel","target")
);
--> statement-breakpoint
ALTER TABLE "ens_eval_pointers" ADD CONSTRAINT "ens_eval_pointers_name_ens_names_name_fk" FOREIGN KEY ("name") REFERENCES "public"."ens_names"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ens_watchers" ADD CONSTRAINT "ens_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ens_watchers" ADD CONSTRAINT "ens_watchers_name_ens_names_name_fk" FOREIGN KEY ("name") REFERENCES "public"."ens_names"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts_seen" ADD CONSTRAINT "broadcasts_seen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts_seen" ADD CONSTRAINT "broadcasts_seen_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_verifications" ADD CONSTRAINT "channel_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_verifications" ADD CONSTRAINT "channel_verifications_channel_id_user_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."user_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channels" ADD CONSTRAINT "user_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_address_index" ON "users" USING btree ("address");