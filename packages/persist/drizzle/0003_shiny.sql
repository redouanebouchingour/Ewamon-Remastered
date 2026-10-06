ALTER TABLE "creature_instances" ADD COLUMN "is_shiny" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dex_entries" ADD COLUMN "shiny_caught" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "is_shiny" boolean DEFAULT false NOT NULL;