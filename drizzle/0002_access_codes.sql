CREATE TABLE `access_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`code_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_codes_hash_unique` ON `access_codes` (`code_hash`);