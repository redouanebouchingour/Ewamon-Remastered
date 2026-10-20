CREATE TABLE "creature_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"creature_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creature_instances" ADD COLUMN "original_trainer_id" uuid;--> statement-breakpoint
ALTER TABLE "creature_instances" ADD COLUMN "original_trainer_name" varchar(20);--> statement-breakpoint
ALTER TABLE "creature_events" ADD CONSTRAINT "creature_events_creature_id_creature_instances_id_fk" FOREIGN KEY ("creature_id") REFERENCES "public"."creature_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creature_events_creature_idx" ON "creature_events" USING btree ("creature_id","id");--> statement-breakpoint
ALTER TABLE "creature_instances" ADD CONSTRAINT "creature_instances_original_trainer_id_players_id_fk" FOREIGN KEY ("original_trainer_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;