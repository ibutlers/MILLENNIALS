BEGIN;

CREATE TABLE investment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reference text NOT NULL UNIQUE,
  app_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  requested_amount_cents bigint NOT NULL CHECK (requested_amount_cents > 0),
  approved_amount_cents bigint CHECK (approved_amount_cents IS NULL OR approved_amount_cents > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved_pending_transfer','transfer_reported','confirmed','rejected','cancelled')),
  investor_message text,
  admin_notes text,
  transfer_reference text,
  transfer_notes text,
  confirmation_notes text,
  approved_by uuid REFERENCES app_users(id),
  approved_at timestamptz,
  transfer_reported_at timestamptz,
  confirmed_by uuid REFERENCES app_users(id),
  confirmed_at timestamptz,
  rejected_by uuid REFERENCES app_users(id),
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX investment_requests_single_active_idx
  ON investment_requests (app_user_id, opportunity_id)
  WHERE status IN ('requested','approved_pending_transfer','transfer_reported');

CREATE INDEX investment_requests_status_idx ON investment_requests (status, created_at DESC);
CREATE INDEX investment_requests_user_idx ON investment_requests (app_user_id, created_at DESC);
CREATE INDEX investment_requests_opportunity_idx ON investment_requests (opportunity_id, created_at DESC);

CREATE TRIGGER investment_requests_set_updated_at BEFORE UPDATE ON investment_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
