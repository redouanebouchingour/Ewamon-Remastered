CREATE TABLE "season_results" (
	"season" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"rating" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	CONSTRAINT "season_results_season_player_id_pk" PRIMARY KEY("season","player_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"season" integer PRIMARY KEY NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_season_seasons_season_fk" FOREIGN KEY ("season") REFERENCES "public"."seasons"("season") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "season_results_rank_idx" ON "season_results" USING btree ("season","rank");--> statement-breakpoint
CREATE INDEX "season_results_player_idx" ON "season_results" USING btree ("player_id");