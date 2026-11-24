-- ticket: #90
CREATE TABLE `company_profiles` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`default_language` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	CONSTRAINT "company_profiles_default_language" CHECK("company_profiles"."default_language" IN ('en', 'es', 'ca'))
);
