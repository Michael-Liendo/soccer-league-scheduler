ALTER TABLE `matches` ADD `clock_started_at` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `clock_elapsed_ms` integer DEFAULT 0 NOT NULL;