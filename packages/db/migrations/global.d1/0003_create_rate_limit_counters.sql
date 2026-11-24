-- ticket: #96
CREATE TABLE `rate_limit_counters` (
	`key` text NOT NULL,
	`window_started_at` text NOT NULL,
	`count` integer NOT NULL,
	`expires_at` text NOT NULL,
	PRIMARY KEY(`key`, `window_started_at`)
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limit_counters__expires_at` ON `rate_limit_counters` (`expires_at`);