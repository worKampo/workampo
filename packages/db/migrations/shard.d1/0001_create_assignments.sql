-- ticket: #90
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`member_id` text NOT NULL,
	`role_key` text NOT NULL,
	`unit_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "assignments_role_key" CHECK("assignments"."role_key" IN ('owner', 'admin', 'member', 'viewer'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_assignments__tenant_id_member_id_role_key_unit_id` ON `assignments` (`tenant_id`,`member_id`,`role_key`,`unit_id`);--> statement-breakpoint
CREATE INDEX `idx_assignments__tenant_id_unit_id` ON `assignments` (`tenant_id`,`unit_id`);