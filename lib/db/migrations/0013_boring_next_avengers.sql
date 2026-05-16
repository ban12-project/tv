DROP INDEX "passkey_credentialID_idx";--> statement-breakpoint
WITH ranked_passkeys AS (
		SELECT
			ctid,
			row_number() OVER (
				PARTITION BY "credential_id"
				ORDER BY "created_at" DESC NULLS LAST, "id" DESC
			) AS row_number
		FROM "passkey"
	)
DELETE FROM "passkey"
WHERE ctid IN (
	SELECT ctid FROM ranked_passkeys WHERE row_number > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credentialID_unique" ON "passkey" USING btree ("credential_id");
--> statement-breakpoint
WITH candidates AS (
		SELECT DISTINCT ON (p."user_id")
			p."user_id",
			lower(trim(p."name")) AS email
		FROM "passkey" p
		INNER JOIN "user" u ON u."id" = p."user_id"
		INNER JOIN "allow_list" a ON lower(a."email") = lower(trim(p."name"))
		WHERE u."is_anonymous" IS TRUE
			AND p."name" IS NOT NULL
			AND trim(p."name") <> ''
			AND lower(trim(p."name")) ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
			AND NOT EXISTS (
				SELECT 1
				FROM "user" existing_user
				WHERE lower(existing_user."email") = lower(trim(p."name"))
					AND existing_user."id" <> p."user_id"
			)
		ORDER BY p."user_id", p."created_at" DESC NULLS LAST, p."id" DESC
	)
UPDATE "user" u
SET
	"email" = candidates.email,
	"is_anonymous" = false,
	"updated_at" = now()
FROM candidates
WHERE u."id" = candidates."user_id";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION promote_anonymous_user_from_passkey()
RETURNS trigger AS $$
DECLARE
	normalized_email text;
	passkey_user record;
BEGIN
	SELECT * INTO passkey_user
	FROM "user"
	WHERE "id" = NEW."user_id"
	FOR UPDATE;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Passkey user does not exist';
	END IF;

	IF passkey_user."is_anonymous" IS DISTINCT FROM TRUE THEN
		RETURN NEW;
	END IF;

	normalized_email := lower(trim(NEW."name"));

	IF normalized_email IS NULL
		OR normalized_email = ''
		OR normalized_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
	THEN
		RAISE EXCEPTION 'Passkey name must be an email for anonymous upgrade';
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM "allow_list"
		WHERE lower("email") = normalized_email
	) THEN
		RAISE EXCEPTION 'Email is not allowlisted for passkey upgrade';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "user"
		WHERE lower("email") = normalized_email
			AND "id" <> NEW."user_id"
	) THEN
		RAISE EXCEPTION 'Email is already registered';
	END IF;

	UPDATE "user"
	SET
		"email" = normalized_email,
		"is_anonymous" = false,
		"updated_at" = now()
	WHERE "id" = NEW."user_id";

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER promote_anonymous_user_from_passkey_before_insert
BEFORE INSERT ON "passkey"
FOR EACH ROW
EXECUTE FUNCTION promote_anonymous_user_from_passkey();
