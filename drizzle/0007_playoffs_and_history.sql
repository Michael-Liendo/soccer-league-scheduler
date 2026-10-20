CREATE TABLE `archives` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `matches` ADD `stage` text DEFAULT 'league' NOT NULL;--> statement-breakpoint
ALTER TABLE `tournament` ADD `playoff` text DEFAULT 'none' NOT NULL;