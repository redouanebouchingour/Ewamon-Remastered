CREATE TABLE "journal_entries" (
	"player_id" uuid NOT NULL,
	"day" varchar(10) NOT NULL,
	"day_number" integer NOT NULL,
	"text" varchar(600) NOT NULL,
	"facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"written_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_pk" PRIMARY KEY("player_id","day"),
	CONSTRAINT "journal_entries_text_ck" CHECK (char_length("journal_entries"."text") between 1 and 600),
	CONSTRAINT "journal_entries_day_ck" CHECK ("journal_entries"."day_number" >= 1)
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;