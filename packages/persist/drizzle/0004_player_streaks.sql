CREATE TABLE "player_streaks" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"best" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_streaks_current_ck" CHECK ("player_streaks"."current" >= 0),
	CONSTRAINT "player_streaks_best_ck" CHECK ("player_streaks"."best" >= "player_streaks"."current")
);
--> statement-breakpoint
ALTER TABLE "player_streaks" ADD CONSTRAINT "player_streaks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_streaks_best_idx" ON "player_streaks" USING btree ("best");