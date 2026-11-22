-- ticket: #96
CREATE TABLE `identities` (
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`provider`, `subject`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "identities_provider" CHECK("identities"."provider" IN ('workos'))
);
--> statement-breakpoint
CREATE INDEX `idx_identities__user_id` ON `identities` (`user_id`);