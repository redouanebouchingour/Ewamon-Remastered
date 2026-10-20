CREATE TABLE "season_legends" (
	"season" integer PRIMARY KEY NOT NULL,
	"species" varchar(32) NOT NULL,
	"player_id" uuid,
	"player_name" varchar(20) NOT NULL,
	"caught_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "season_legends" ADD CONSTRAINT "season_legends_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;