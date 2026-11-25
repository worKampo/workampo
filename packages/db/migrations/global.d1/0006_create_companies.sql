-- ticket: #90
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`shard_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`shard_id`) REFERENCES `shards`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "companies_status" CHECK("companies"."status" IN ('active', 'trialing', 'deleting'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_companies__slug` ON `companies` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_companies__shard_id` ON `companies` (`shard_id`);