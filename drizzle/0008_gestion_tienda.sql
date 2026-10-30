ALTER TABLE sales ADD COLUMN paid boolean NOT NULL DEFAULT false;
ALTER TABLE sales ADD COLUMN packed boolean NOT NULL DEFAULT false;
ALTER TABLE sales ADD COLUMN delivered boolean NOT NULL DEFAULT false;
UPDATE sales SET paid = true WHERE status IN ('pagada', 'enviada', 'entregada');
UPDATE sales SET delivered = true WHERE status = 'entregada';
CREATE TABLE api_tokens (
  id text PRIMARY KEY, name text NOT NULL, user_id integer NOT NULL CONSTRAINT api_tokens_user_id_users_id_fk REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
