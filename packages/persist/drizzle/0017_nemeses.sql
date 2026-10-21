CREATE TABLE "nemeses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"species_id" varchar(32) NOT NULL,
	"level" smallint NOT NULL,
	"name" varchar(16) NOT NULL,
	"title" varchar(32) NOT NULL,
	"scar" varchar(16) NOT NULL,
	"move" varchar(32),
	"rank" smallint DEFAULT 1 NOT NULL,
	"ability" varchar(32) NOT NULL,
	"variant_key" varchar(8) DEFAULT 'normal' NOT NULL,
	"is_shiny" boolean DEFAULT false NOT NULL,
	"is_alpha" boolean DEFAULT false NOT NULL,
	"born_zone" varchar(32) NOT NULL,
	"last_zone" varchar(32) NOT NULL,
	"memory" jsonb NOT NULL,
	"status" varchar(8) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nemeses_status_ck" CHECK ("nemeses"."status" in ('active', 'beaten', 'caught', 'faded')),
	CONSTRAINT "nemeses_rank_ck" CHECK ("nemeses"."rank" between 1 and 5),
	CONSTRAINT "nemeses_level_ck" CHECK ("nemeses"."level" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "nemeses" ADD CONSTRAINT "nemeses_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nemeses_owner_idx" ON "nemeses" USING btree ("owner_id","status");