CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`location` text NOT NULL,
	`status` text DEFAULT 'operational' NOT NULL,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_assets_status` ON `assets` (`status`);--> statement-breakpoint
CREATE INDEX `idx_assets_category` ON `assets` (`category`);--> statement-breakpoint
CREATE TABLE `maintenance_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`description` text NOT NULL,
	`technician` text NOT NULL,
	`cost_cents` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`performed_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_maintenance_asset_id` ON `maintenance_records` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_maintenance_performed_at` ON `maintenance_records` (`performed_at`);--> statement-breakpoint
CREATE INDEX `idx_maintenance_status` ON `maintenance_records` (`status`);