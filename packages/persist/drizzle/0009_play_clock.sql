CREATE TABLE "run_splits" (
	"player_id" uuid NOT NULL,
	"split" varchar(48) NOT NULL,
	"play_ms" bigint NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_splits_player_id_split_pk" PRIMARY KEY("player_id","split")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "play_ms" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "play_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "run_splits" ADD CONSTRAINT "run_splits_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;