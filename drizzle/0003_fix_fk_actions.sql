-- Migrations 0001/0002 added `transactions.category_id` and
-- `budgets.subcategory_id` via ALTER TABLE without the ON DELETE actions the
-- schema declares, so deleting a category with categorized transactions (or a
-- subcategory with scoped budgets) failed with a FOREIGN KEY error. SQLite
-- cannot alter constraints in place, so both tables are rebuilt with the
-- correct actions, preserving all data.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_id` text NOT NULL,
	`subcategory_id` text,
	`category_id` text,
	`amount` integer NOT NULL,
	`direction` text NOT NULL,
	`title` text,
	`note` text,
	`date` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transactions` (`id`, `wallet_id`, `subcategory_id`, `category_id`, `amount`, `direction`, `title`, `note`, `date`, `created_at`)
SELECT `id`, `wallet_id`, `subcategory_id`, `category_id`, `amount`, `direction`, `title`, `note`, `date`, `created_at` FROM `transactions`;
--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE TABLE `__new_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`amount` integer NOT NULL,
	`category_id` text,
	`subcategory_id` text,
	`wallet_id` text,
	`period` text DEFAULT 'month' NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`currency` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_budgets` (`id`, `name`, `amount`, `category_id`, `subcategory_id`, `wallet_id`, `period`, `start_date`, `end_date`, `currency`, `created_at`)
SELECT `id`, `name`, `amount`, `category_id`, `subcategory_id`, `wallet_id`, `period`, `start_date`, `end_date`, `currency`, `created_at` FROM `budgets`;
--> statement-breakpoint
DROP TABLE `budgets`;--> statement-breakpoint
ALTER TABLE `__new_budgets` RENAME TO `budgets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
