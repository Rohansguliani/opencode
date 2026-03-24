CREATE TABLE `workspace_state` (
	`actor` text PRIMARY KEY,
	`projects` text NOT NULL,
	`last_project` text,
	`page` text NOT NULL,
	`time_updated` integer NOT NULL
);
