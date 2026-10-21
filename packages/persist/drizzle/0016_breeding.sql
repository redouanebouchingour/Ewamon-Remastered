ALTER TYPE "public"."slot_kind" ADD VALUE 'daycare';--> statement-breakpoint
CREATE TABLE "daycare" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"egg_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "eggs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"place" varchar(8) DEFAULT 'party' NOT NULL,
	"species_id" varchar(32) NOT NULL,
	"steps_total" integer NOT NULL,
	"steps_walked" integer DEFAULT 0 NOT NULL,
	"honor" smallint DEFAULT 0 NOT NULL,
	"variant_key" varchar(8) DEFAULT 'normal' NOT NULL,
	"ability" varchar(32) NOT NULL,
	"moves" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_shiny" boolean DEFAULT false NOT NULL,
	"bandborn" boolean DEFAULT false NOT NULL,
	"parents" jsonb NOT NULL,
	"zone_id" varchar(32) NOT NULL,
	"laid_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eggs_place_ck" CHECK ("eggs"."place" in ('party', 'box')),
	CONSTRAINT "eggs_steps_ck" CHECK ("eggs"."steps_walked" between 0 and "eggs"."steps_total")
);
--> statement-breakpoint
ALTER TABLE "creature_instances" ADD COLUMN "bandborn" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daycare" ADD CONSTRAINT "daycare_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eggs_owner_idx" ON "eggs" USING btree ("owner_id","place");