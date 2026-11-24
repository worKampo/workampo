-- ticket: #90
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "members_status" CHECK("members"."status" IN ('active', 'suspended', 'leaving'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_members__tenant_id_user_id` ON `members` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_members__user_id` ON `members` (`user_id`);