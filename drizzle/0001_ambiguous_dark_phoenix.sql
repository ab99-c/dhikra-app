CREATE TABLE `content_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`sourceType` varchar(64) NOT NULL,
	`sourceUri` text,
	`title` varchar(255),
	`rawText` text,
	`ocrText` text,
	`imageContextTags` json NOT NULL,
	`theme` enum('spirituality','productivity','article','quote','recipe','appointment','family','other') NOT NULL DEFAULT 'other',
	`capturedAt` timestamp NOT NULL,
	`status` enum('captured','queued','revisited','completed','dismissed') NOT NULL DEFAULT 'captured',
	`userDelayPref` enum('3_hours','tomorrow','3_days','1_week','decide_for_me') NOT NULL DEFAULT 'decide_for_me',
	`scheduledFor` timestamp,
	`revisitCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_library_id` PRIMARY KEY(`id`)
);
