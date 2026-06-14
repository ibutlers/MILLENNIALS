CREATE TYPE lead_kind AS ENUM ('access_request', 'opportunity_inquiry', 'general_contact');
CREATE TYPE lead_status AS ENUM ('new', 'in_review', 'contacted', 'qualified', 'closed', 'rejected');

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reference text NOT NULL UNIQUE,
  kind lead_kind NOT NULL,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 80),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (email = lower(email) AND char_length(email) <= 254),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  country_code char(2) CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  investment_range text CHECK (investment_range IS NULL OR char_length(investment_range) <= 80),
  message text CHECK (message IS NULL OR char_length(message) <= 2000),
  status lead_status NOT NULL DEFAULT 'new',
  source_path text NOT NULL CHECK (char_length(source_path) <= 240),
  referrer text CHECK (referrer IS NULL OR char_length(referrer) <= 500),
  utm_source text CHECK (utm_source IS NULL OR char_length(utm_source) <= 120),
  utm_medium text CHECK (utm_medium IS NULL OR char_length(utm_medium) <= 120),
  utm_campaign text CHECK (utm_campaign IS NULL OR char_length(utm_campaign) <= 120),
  privacy_policy_version text NOT NULL CHECK (char_length(privacy_policy_version) BETWEEN 1 AND 40),
  privacy_accepted_at timestamptz NOT NULL,
  risk_acknowledged_at timestamptz,
  marketing_opt_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_required_for_inquiry CHECK ((kind = 'opportunity_inquiry') = (opportunity_id IS NOT NULL))
);

CREATE INDEX leads_status_created_at_idx ON leads(status, created_at DESC);
CREATE INDEX leads_kind_created_at_idx ON leads(kind, created_at DESC);
CREATE INDEX leads_opportunity_id_idx ON leads(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX leads_email_recent_idx ON leads(email, created_at DESC);

CREATE TRIGGER set_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
