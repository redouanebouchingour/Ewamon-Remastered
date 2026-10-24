CREATE TABLE "npc_memories" (
	"player_id" uuid NOT NULL,
	"npc_id" varchar(80) NOT NULL,
	"zone_id" varchar(32) NOT NULL,
	"summary" varchar(400) DEFAULT '' NOT NULL,
	"standing" smallint DEFAULT 0 NOT NULL,
	"deeds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"talks" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "npc_memories_pk" PRIMARY KEY("player_id","npc_id"),
	CONSTRAINT "npc_memories_standing_ck" CHECK ("npc_memories"."standing" between -10 and 10)
);
--> statement-breakpoint
ALTER TABLE "npc_memories" ADD CONSTRAINT "npc_memories_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "npc_memories_zone_idx" ON "npc_memories" USING btree ("player_id","zone_id");