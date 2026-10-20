CREATE TABLE "ghost_battles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ghost_id" uuid NOT NULL,
	"challenger" varchar(20) NOT NULL,
	"zone_id" varchar(32) NOT NULL,
	"won" boolean NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghosts" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(20) NOT NULL,
	"zone_id" varchar(32) NOT NULL,
	"party" jsonb NOT NULL,
	"top_level" smallint NOT NULL,
	"left_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ghost_battles" ADD CONSTRAINT "ghost_battles_ghost_id_players_id_fk" FOREIGN KEY ("ghost_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghosts" ADD CONSTRAINT "ghosts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ghost_battles_ghost_idx" ON "ghost_battles" USING btree ("ghost_id","seen","at");--> statement-breakpoint
CREATE INDEX "ghosts_zone_idx" ON "ghosts" USING btree ("zone_id","left_at");