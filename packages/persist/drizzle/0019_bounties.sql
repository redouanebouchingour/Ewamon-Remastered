CREATE TABLE "bounties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(8) NOT NULL,
	"target_id" uuid,
	"target_name" varchar(64) NOT NULL,
	"species_id" varchar(32) NOT NULL,
	"level" smallint NOT NULL,
	"zone_id" varchar(32) NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"poster_id" uuid,
	"poster_name" varchar(20),
	"reward" integer NOT NULL,
	"fee" integer DEFAULT 0 NOT NULL,
	"status" varchar(8) DEFAULT 'open' NOT NULL,
	"claimer_id" uuid,
	"claimer_name" varchar(20),
	"payout" integer,
	"bonus" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "bounties_kind_ck" CHECK ("bounties"."kind" in ('game', 'player', 'nemesis')),
	CONSTRAINT "bounties_status_ck" CHECK ("bounties"."status" in ('open', 'claimed', 'expired')),
	CONSTRAINT "bounties_reward_ck" CHECK ("bounties"."reward" >= 0 and "bounties"."fee" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_target_id_players_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_poster_id_players_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_claimer_id_players_id_fk" FOREIGN KEY ("claimer_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bounties_open_idx" ON "bounties" USING btree ("status","target_id");--> statement-breakpoint
CREATE INDEX "bounties_poster_idx" ON "bounties" USING btree ("poster_id","status");--> statement-breakpoint
CREATE INDEX "bounties_claimer_idx" ON "bounties" USING btree ("claimer_id","claimed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bounties_game_open_uq" ON "bounties" USING btree ("target_id") WHERE "bounties"."kind" = 'game' and "bounties"."status" = 'open';