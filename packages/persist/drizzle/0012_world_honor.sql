CREATE TABLE "world_honor" (
	"season" integer NOT NULL,
	"zone_id" varchar(32) NOT NULL,
	"light" integer DEFAULT 0 NOT NULL,
	"shadow" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "world_honor_season_zone_id_pk" PRIMARY KEY("season","zone_id")
);
