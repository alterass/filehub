CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"mime_type" text,
	"storage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_nodes_parent" ON "nodes" ("parent_id");
--> statement-breakpoint
CREATE INDEX "idx_nodes_owner" ON "nodes" ("owner_id");
--> statement-breakpoint
CREATE INDEX "idx_nodes_name" ON "nodes" ("name");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_nodes_unique_name" ON "nodes" ("parent_id", "owner_id", "name");
