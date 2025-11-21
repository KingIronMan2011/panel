CREATE TABLE `user_impersonation_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`issued_by` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_impersonation_tokens_token_hash_unique` ON `user_impersonation_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `user_impersonation_tokens_user_id_index` ON `user_impersonation_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_impersonation_tokens_token_hash_index` ON `user_impersonation_tokens` (`token_hash`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `impersonated_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `suspended` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `suspended_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `suspension_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `password_reset_required` integer DEFAULT false NOT NULL;