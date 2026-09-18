CREATE TYPE "public"."battle_format" AS ENUM('wild', 'trainer', 'league', 'pvp', 'raid');--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."guild_role" AS ENUM('leader', 'officer', 'member');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'sold', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."slot_kind" AS ENUM('party', 'box', 'listing', 'trade_escrow');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" varchar(48) NOT NULL,
	"subject" varchar(64),
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creature_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slot_kind" "slot_kind" NOT NULL,
	"slot_index" integer NOT NULL,
	"species_id" varchar(32) NOT NULL,
	"nickname" varchar(16),
	"level" smallint NOT NULL,
	"exp" integer DEFAULT 0 NOT NULL,
	"hp" integer NOT NULL,
	"moves" jsonb NOT NULL,
	"status" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ability" varchar(32) NOT NULL,
	"held_item" varchar(32),
	"variant_key" varchar(8) DEFAULT 'normal' NOT NULL,
	"is_alpha" boolean DEFAULT false NOT NULL,
	"caught_zone_id" varchar(32),
	"caught_at" timestamp with time zone,
	"ribbons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "creature_level_ck" CHECK ("creature_instances"."level" between 1 and 100),
	CONSTRAINT "creature_hp_ck" CHECK ("creature_instances"."hp" >= 0),
	CONSTRAINT "creature_party_slot_ck" CHECK ("creature_instances"."slot_kind" <> 'party' or "creature_instances"."slot_index" between 0 and 5 or "creature_instances"."slot_index" between 100 and 105)
);
--> statement-breakpoint
CREATE TABLE "battle_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"battle_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"opponent" varchar(64) NOT NULL,
	"format" "battle_format" NOT NULL,
	"result" varchar(8) NOT NULL,
	"turns" smallint NOT NULL,
	"rating_delta" integer,
	"rewards" jsonb NOT NULL,
	"seed" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"happened_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_pass" (
	"player_id" uuid NOT NULL,
	"level" smallint NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mythical_choice" varchar(16),
	CONSTRAINT "battle_pass_player_id_level_pk" PRIMARY KEY("player_id","level")
);
--> statement-breakpoint
CREATE TABLE "trade_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"trade_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"sent" jsonb NOT NULL,
	"received" jsonb NOT NULL,
	"money_sent" integer DEFAULT 0 NOT NULL,
	"money_received" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(20) NOT NULL,
	"username_lower" varchar(20) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"money" integer DEFAULT 3000 NOT NULL,
	"zone_id" varchar(32) DEFAULT 'mirevale' NOT NULL,
	"x" real DEFAULT 0 NOT NULL,
	"z" real DEFAULT 6 NOT NULL,
	"angle" real DEFAULT 0 NOT NULL,
	"body" varchar(32) DEFAULT 'ranger_m' NOT NULL,
	"title" varchar(40) DEFAULT 'Rookie Trainer' NOT NULL,
	"motto" varchar(120) DEFAULT '' NOT NULL,
	"rating" integer DEFAULT 1000 NOT NULL,
	"peak_rating" integer DEFAULT 1000 NOT NULL,
	"ranked_matches" integer DEFAULT 0 NOT NULL,
	"trainer_exp" integer DEFAULT 0 NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp with time zone,
	"ban_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_money_ck" CHECK ("players"."money" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"player_id" uuid NOT NULL,
	"item_id" varchar(32) NOT NULL,
	"qty" integer NOT NULL,
	CONSTRAINT "inventory_items_player_id_item_id_pk" PRIMARY KEY("player_id","item_id"),
	CONSTRAINT "inventory_qty_ck" CHECK ("inventory_items"."qty" between 0 and 999)
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"player_id" uuid NOT NULL,
	"badge_id" varchar(16) NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badges_player_id_badge_id_pk" PRIMARY KEY("player_id","badge_id")
);
--> statement-breakpoint
CREATE TABLE "dex_entries" (
	"player_id" uuid NOT NULL,
	"species_id" varchar(32) NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"caught_at" timestamp with time zone,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alpha_seen" boolean DEFAULT false NOT NULL,
	CONSTRAINT "dex_entries_player_id_species_id_pk" PRIMARY KEY("player_id","species_id")
);
--> statement-breakpoint
CREATE TABLE "quest_progress" (
	"player_id" uuid NOT NULL,
	"quest_id" varchar(48) NOT NULL,
	"objective_id" varchar(48) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "quest_progress_player_id_quest_id_objective_id_pk" PRIMARY KEY("player_id","quest_id","objective_id")
);
--> statement-breakpoint
CREATE TABLE "story_flags" (
	"player_id" uuid NOT NULL,
	"flag" varchar(64) NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_flags_player_id_flag_pk" PRIMARY KEY("player_id","flag")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_requester_id_addressee_id_pk" PRIMARY KEY("requester_id","addressee_id"),
	CONSTRAINT "friendship_not_self_ck" CHECK ("friendships"."requester_id" <> "friendships"."addressee_id")
);
--> statement-breakpoint
CREATE TABLE "guild_members" (
	"guild_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"role" "guild_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_members_guild_id_player_id_pk" PRIMARY KEY("guild_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(24) NOT NULL,
	"name_lower" varchar(24) NOT NULL,
	"tag" varchar(4) NOT NULL,
	"leader_id" uuid NOT NULL,
	"motd" varchar(200) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"text" varchar(300) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"listing_id" uuid NOT NULL,
	"bidder_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"creature_id" uuid NOT NULL,
	"species_id" varchar(32) NOT NULL,
	"level" smallint NOT NULL,
	"variant_key" varchar(8) NOT NULL,
	"is_alpha" boolean NOT NULL,
	"starting_bid" integer NOT NULL,
	"current_bid" integer,
	"current_bidder_id" uuid,
	"buy_now_price" integer,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creature_instances" ADD CONSTRAINT "creature_instances_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_history" ADD CONSTRAINT "battle_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_pass" ADD CONSTRAINT "battle_pass_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_history" ADD CONSTRAINT "trade_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_history" ADD CONSTRAINT "trade_history_partner_id_players_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dex_entries" ADD CONSTRAINT "dex_entries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_flags" ADD CONSTRAINT "story_flags_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_players_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_players_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_leader_id_players_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_from_id_players_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_to_id_players_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_players_id_fk" FOREIGN KEY ("bidder_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_players_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_creature_id_creature_instances_id_fk" FOREIGN KEY ("creature_id") REFERENCES "public"."creature_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_current_bidder_id_players_id_fk" FOREIGN KEY ("current_bidder_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id","at");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action","at");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_uq" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_player_idx" ON "refresh_tokens" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creature_owner_slot_uq" ON "creature_instances" USING btree ("owner_id","slot_kind","slot_index");--> statement-breakpoint
CREATE INDEX "creature_owner_idx" ON "creature_instances" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "creature_species_idx" ON "creature_instances" USING btree ("species_id");--> statement-breakpoint
CREATE INDEX "battle_history_player_idx" ON "battle_history" USING btree ("player_id","happened_at");--> statement-breakpoint
CREATE INDEX "trade_history_player_idx" ON "trade_history" USING btree ("player_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "players_username_lower_uq" ON "players" USING btree ("username_lower");--> statement-breakpoint
CREATE UNIQUE INDEX "players_email_uq" ON "players" USING btree ("email");--> statement-breakpoint
CREATE INDEX "players_rating_idx" ON "players" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "friendships_addressee_idx" ON "friendships" USING btree ("addressee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pair_uq" ON "friendships" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"));--> statement-breakpoint
CREATE UNIQUE INDEX "guild_members_player_uq" ON "guild_members" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guilds_name_lower_uq" ON "guilds" USING btree ("name_lower");--> statement-breakpoint
CREATE UNIQUE INDEX "guilds_tag_uq" ON "guilds" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "messages_pair_idx" ON "messages" USING btree ("from_id","to_id","sent_at");--> statement-breakpoint
CREATE INDEX "messages_to_unread_idx" ON "messages" USING btree ("to_id","read_at");--> statement-breakpoint
CREATE INDEX "bids_listing_idx" ON "bids" USING btree ("listing_id","placed_at");--> statement-breakpoint
CREATE INDEX "listings_active_idx" ON "listings" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "listings_seller_idx" ON "listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "listings_search_idx" ON "listings" USING btree ("status","species_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_creature_active_uq" ON "listings" USING btree ("creature_id") WHERE "listings"."status" = 'active';