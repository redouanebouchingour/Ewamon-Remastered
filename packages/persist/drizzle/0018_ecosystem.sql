CREATE TABLE "eco_takes" (
	"zone_id" varchar(32) NOT NULL,
	"week" integer NOT NULL,
	"species_id" varchar(32) NOT NULL,
	"caught" integer DEFAULT 0 NOT NULL,
	"ko" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "eco_takes_zone_id_week_species_id_pk" PRIMARY KEY("zone_id","week","species_id")
);
