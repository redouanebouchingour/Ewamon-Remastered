CREATE TABLE "camp_raids" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"zone_id" varchar(32) NOT NULL,
	"owner_id" uuid NOT NULL,
	"raider_id" uuid NOT NULL,
	"raider_name" varchar(20) NOT NULL,
	"won" boolean NOT NULL,
	"cut" integer DEFAULT 0 NOT NULL,
	"took_over" boolean DEFAULT false NOT NULL,
	"held" boolean DEFAULT false NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "camps" (
	"zone_id" varchar(32) PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_name" varchar(20) NOT NULL,
	"name" varchar(24) NOT NULL,
	"trophies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"guard" jsonb NOT NULL,
	"guard_top" smallint NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "camps_owner_uq" UNIQUE("owner_id")
);
--> statement-breakpoint
ALTER TABLE "camp_raids" ADD CONSTRAINT "camp_raids_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camp_raids" ADD CONSTRAINT "camp_raids_raider_id_players_id_fk" FOREIGN KEY ("raider_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "camps" ADD CONSTRAINT "camps_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "camp_raids_owner_idx" ON "camp_raids" USING btree ("owner_id","seen","at");--> statement-breakpoint
CREATE INDEX "camp_raids_raider_idx" ON "camp_raids" USING btree ("raider_id","zone_id","at");