CREATE TABLE "player_blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "player_blocks_not_self_ck" CHECK ("player_blocks"."blocker_id" <> "player_blocks"."blocked_id")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "dms_from" varchar(8) DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "player_blocks" ADD CONSTRAINT "player_blocks_blocker_id_players_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_blocks" ADD CONSTRAINT "player_blocks_blocked_id_players_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_blocks_blocked_idx" ON "player_blocks" USING btree ("blocked_id");