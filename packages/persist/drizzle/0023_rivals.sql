CREATE TABLE "rivals" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(16) NOT NULL,
	"look" varchar(32) NOT NULL,
	"temperament" varchar(16) NOT NULL,
	"signature" varchar(32) NOT NULL,
	"player_wins" smallint DEFAULT 0 NOT NULL,
	"rival_wins" smallint DEFAULT 0 NOT NULL,
	"draws" smallint DEFAULT 0 NOT NULL,
	"meetings" integer DEFAULT 0 NOT NULL,
	"last_result" varchar(8),
	"last_zone" varchar(32),
	"last_met_at" timestamp with time zone,
	"last_team" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_words" varchar(200),
	"next_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rivals_record_ck" CHECK ("rivals"."player_wins" >= 0 and "rivals"."rival_wins" >= 0 and "rivals"."draws" >= 0 and "rivals"."meetings" >= 0),
	CONSTRAINT "rivals_result_ck" CHECK ("rivals"."last_result" is null or "rivals"."last_result" in ('won', 'lost', 'draw'))
);
--> statement-breakpoint
ALTER TABLE "rivals" ADD CONSTRAINT "rivals_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;