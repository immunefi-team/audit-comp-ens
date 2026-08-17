DROP TABLE "ens_eval_pointers" CASCADE;--> statement-breakpoint
DROP TABLE "ens_names" CASCADE;--> statement-breakpoint
DROP TABLE "ens_watchers" CASCADE;--> statement-breakpoint
UPDATE users SET address=lower(address);
