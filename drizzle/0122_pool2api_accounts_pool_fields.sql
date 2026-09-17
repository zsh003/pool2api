-- pool2api migration: accounts table + pool label fields on providers
-- Creates the portal user account table and adds cc-switch pool metadata columns

-- New enum for account roles
CREATE TYPE "public"."account_role" AS ENUM('user', 'admin');

-- Portal accounts table (identity/auth layer distinct from quota-slot users)
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar NOT NULL,
	"role" "account_role" DEFAULT 'user' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"invite_token" varchar(64),
	"linked_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);

CREATE UNIQUE INDEX "idx_accounts_email" ON "accounts" USING btree ("email");
CREATE INDEX "idx_accounts_linked_user" ON "accounts" USING btree ("linked_user_id");

-- Pool metadata columns on providers table
ALTER TABLE "providers"
	ADD COLUMN "pool_label" varchar(100),
	ADD COLUMN "pool_source" varchar(50) DEFAULT 'manual',
	ADD COLUMN "pool_import_id" varchar(100);
