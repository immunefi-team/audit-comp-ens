CREATE TABLE "transactions" (
	"user_id" uuid NOT NULL,
	"tx_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"hash" text,
	"status" text NOT NULL,
	"operation" text,
	"name" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_user_id_tx_id_pk" PRIMARY KEY("user_id","tx_id")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;