-- ticket: #90
CREATE TABLE `company_creation_requests` (
	`user_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`body_hash` text NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `idempotency_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_company_creation_requests__tenant_id` ON `company_creation_requests` (`tenant_id`);