-- ticket: #90
CREATE TABLE `company_contacts` (
	`tenant_id` text NOT NULL,
	`topic` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`tenant_id`, `topic`, `user_id`),
	FOREIGN KEY (`tenant_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "company_contacts_topic" CHECK("company_contacts"."topic" IN ('main'))
);
--> statement-breakpoint
CREATE INDEX `idx_company_contacts__user_id` ON `company_contacts` (`user_id`);