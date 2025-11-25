PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_server_limits` (
	`server_id` text PRIMARY KEY NOT NULL,
	`memory` integer,
	`memory_overallocate` integer,
	`disk` integer,
	`disk_overallocate` integer,
	`io` integer,
	`cpu` integer,
	`threads` text,
	`oom_disabled` integer DEFAULT true NOT NULL,
	`database_limit` integer,
	`allocation_limit` integer,
	`backup_limit` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_server_limits`("server_id", "memory", "memory_overallocate", "disk", "disk_overallocate", "io", "cpu", "threads", "oom_disabled", "database_limit", "allocation_limit", "backup_limit", "created_at", "updated_at") SELECT "server_id", "memory", "memory_overallocate", "disk", "disk_overallocate", "io", "cpu", "threads", "oom_disabled", "database_limit", "allocation_limit", "backup_limit", "created_at", "updated_at" FROM `server_limits`;--> statement-breakpoint
DROP TABLE `server_limits`;--> statement-breakpoint
ALTER TABLE `__new_server_limits` RENAME TO `server_limits`;--> statement-breakpoint
PRAGMA foreign_keys=ON;