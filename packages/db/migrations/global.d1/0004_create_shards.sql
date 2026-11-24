-- ticket: #90
CREATE TABLE `shards` (
	`id` text PRIMARY KEY NOT NULL,
	`engine` text NOT NULL,
	`binding_name` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "shards_engine" CHECK("shards"."engine" IN ('d1'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_shards__binding_name` ON `shards` (`binding_name`);