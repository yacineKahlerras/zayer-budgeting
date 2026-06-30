CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`amount` integer NOT NULL,
	`category_id` text,
	`wallet_id` text,
	`period` text DEFAULT 'month' NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`currency` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`color` text,
	`kind` text DEFAULT 'expense' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subcategories` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_id` text NOT NULL,
	`subcategory_id` text,
	`amount` integer NOT NULL,
	`direction` text NOT NULL,
	`title` text,
	`note` text,
	`date` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`initial_balance` integer DEFAULT 0 NOT NULL,
	`icon` text,
	`color` text,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
