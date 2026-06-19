-- Align lead assignment with the Better Auth/admin user model.
-- The admin workflow assigns converted leads to app_users, not legacy users.
ALTER TABLE leads DROP CONSTRAINT leads_assigned_user_id_fkey;

UPDATE leads
SET assigned_user_id = NULL,
    updated_at = now()
WHERE assigned_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM app_users WHERE app_users.id = leads.assigned_user_id
  );

ALTER TABLE leads
  ADD CONSTRAINT leads_assigned_user_id_fkey
  FOREIGN KEY (assigned_user_id) REFERENCES app_users(id) ON DELETE SET NULL;
