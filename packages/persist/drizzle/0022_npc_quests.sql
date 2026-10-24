CREATE TABLE "npc_quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"npc_id" varchar(80) NOT NULL,
	"zone_id" varchar(32) NOT NULL,
	"seq" integer NOT NULL,
	"status" varchar(10) DEFAULT 'offered' NOT NULL,
	"objective" jsonb NOT NULL,
	"reward" jsonb NOT NULL,
	"target" smallint NOT NULL,
	"progress" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "npc_quests_status_ck" CHECK ("npc_quests"."status" in ('offered', 'active', 'claimed', 'declined', 'abandoned', 'expired')),
	CONSTRAINT "npc_quests_progress_ck" CHECK ("npc_quests"."progress" >= 0 and "npc_quests"."target" >= 1)
);
--> statement-breakpoint
ALTER TABLE "npc_quests" ADD CONSTRAINT "npc_quests_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "npc_quests_player_idx" ON "npc_quests" USING btree ("player_id","status");--> statement-breakpoint
CREATE INDEX "npc_quests_npc_idx" ON "npc_quests" USING btree ("player_id","npc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "npc_quests_open_uq" ON "npc_quests" USING btree ("player_id","npc_id") WHERE "npc_quests"."status" in ('offered', 'active');