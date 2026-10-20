CREATE TABLE "daily_results" (
	"player_id" uuid NOT NULL,
	"day_key" varchar(10) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"turns" smallint,
	"marks" varchar(200),
	"battle_id" uuid,
	"won_at" timestamp with time zone,
	CONSTRAINT "daily_results_player_id_day_key_pk" PRIMARY KEY("player_id","day_key"),
	CONSTRAINT "daily_results_turns_ck" CHECK ("daily_results"."turns" is null or "daily_results"."turns" >= 1)
);
--> statement-breakpoint
ALTER TABLE "daily_results" ADD CONSTRAINT "daily_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_results_day_idx" ON "daily_results" USING btree ("day_key","turns","won_at");