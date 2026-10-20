CREATE TABLE "battle_shares" (
	"token" varchar(16) PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"battle_id" uuid NOT NULL,
	"replay" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "battle_shares" ADD CONSTRAINT "battle_shares_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "battle_shares_player_battle_uq" ON "battle_shares" USING btree ("player_id","battle_id");