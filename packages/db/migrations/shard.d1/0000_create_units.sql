-- ticket: #90
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`parent_id` text,
	`name` text,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`attributes` text DEFAULT '{}' NOT NULL,
	`is_active` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_units__tenant_id` ON `units` (`tenant_id`) WHERE "units"."parent_id" IS NULL;--> statement-breakpoint
CREATE INDEX `idx_units__tenant_id_path` ON `units` (`tenant_id`,`path`);--> statement-breakpoint
CREATE INDEX `idx_units__tenant_id_parent_id` ON `units` (`tenant_id`,`parent_id`);