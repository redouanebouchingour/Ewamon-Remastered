CREATE TABLE "dex_rewards" (
	"player_id" uuid NOT NULL,
	"reward_id" varchar(64) NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dex_rewards_player_id_reward_id_pk" PRIMARY KEY("player_id","reward_id")
);
--> statement-breakpoint
ALTER TABLE "dex_entries" ADD COLUMN "counters" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "dex_entries" ADD COLUMN "first_seen_zone" varchar(32);--> statement-breakpoint
ALTER TABLE "dex_entries" ADD COLUMN "viewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dex_rewards" ADD CONSTRAINT "dex_rewards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Dex research backfill: every existing entry was seen once; a caught species was caught once; alpha_seen is an alpha
-- catch; each non-normal variant on record is one variant catch. Keys whose value would be null are left out. Every
-- existing entry counts as viewed at its latest record, so an old collection shows no "new" markers.
UPDATE "dex_entries" SET "viewed_at" = COALESCE("caught_at", "seen_at"), "counters" = jsonb_strip_nulls(jsonb_build_object(
	'seen', 1,
	'caught', CASE WHEN "caught_at" IS NOT NULL THEN 1 END,
	'alpha', CASE WHEN "alpha_seen" THEN 1 END,
	'variant', NULLIF((SELECT count(*)::int FROM jsonb_array_elements_text("variants") AS v(k) WHERE v.k <> 'normal'), 0)
));
