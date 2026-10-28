CREATE TABLE "player_banners" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"frame" varchar(32) NOT NULL,
	"backdrop" varchar(32) NOT NULL,
	"pins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"trackers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"featured_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_banners" ADD CONSTRAINT "player_banners_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_banners" ADD CONSTRAINT "player_banners_featured_id_creature_instances_id_fk" FOREIGN KEY ("featured_id") REFERENCES "public"."creature_instances"("id") ON DELETE set null ON UPDATE no action;