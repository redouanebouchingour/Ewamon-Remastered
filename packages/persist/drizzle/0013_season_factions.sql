CREATE TABLE "season_factions" (
	"season" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"side" varchar(8) NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_factions_season_player_id_pk" PRIMARY KEY("season","player_id")
);
--> statement-breakpoint
ALTER TABLE "season_factions" ADD CONSTRAINT "season_factions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "season_factions_side_idx" ON "season_factions" USING btree ("season","side","points");