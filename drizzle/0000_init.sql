CREATE TABLE `match_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_days_date_unique` ON `match_days` (`date`);--> statement-breakpoint
CREATE TABLE `match_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`player_id` integer,
	`player_name` text NOT NULL,
	`type` text NOT NULL,
	`minute` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `match_events_match_idx` ON `match_events` (`match_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_day_id` integer NOT NULL,
	`round` integer NOT NULL,
	`leg` integer NOT NULL,
	`slot` integer NOT NULL,
	`time` text,
	`venue` text,
	`home_team_id` integer NOT NULL,
	`away_team_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`home_score` integer DEFAULT 0 NOT NULL,
	`away_score` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`match_day_id`) REFERENCES `match_days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `matches_day_idx` ON `matches` (`match_day_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`name` text NOT NULL,
	`number` text,
	`position` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `players_team_idx` ON `players` (`team_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tournament` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`venue` text DEFAULT '' NOT NULL,
	`players_on_field` integer DEFAULT 3 NOT NULL,
	`points_win` integer DEFAULT 3 NOT NULL,
	`points_draw` integer DEFAULT 1 NOT NULL,
	`points_loss` integer DEFAULT 0 NOT NULL,
	`legs` integer DEFAULT 1 NOT NULL,
	`start_time` text DEFAULT '09:00' NOT NULL,
	`end_time` text DEFAULT '13:00' NOT NULL,
	`match_minutes` integer DEFAULT 20 NOT NULL,
	`break_minutes` integer DEFAULT 5 NOT NULL,
	`updated_at` integer NOT NULL
);
