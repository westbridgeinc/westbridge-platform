-- AlterTable: add unique constraint on (account_id, email) to invite_tokens
-- Originally generated with model name "InviteToken"; corrected to use the
-- actual table name "invite_tokens" and mapped column names (snake_case).
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_account_id_email_key" UNIQUE ("account_id", "email");
