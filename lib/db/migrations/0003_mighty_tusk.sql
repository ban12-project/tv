CREATE TABLE "allow_list" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allow_list_email_unique" UNIQUE("email")
);
