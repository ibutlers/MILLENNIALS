# PostgreSQL Schema Inventory — Realstate

**Database:** `realstate`
**Container:** `current-postgres-1`
**Generated:** 2026-06-15
**Total tables:** 15

---

## ENUM Types (10)

### `audit_event_type`
| Value |
|---|
| `account_created` |
| `email_verified` |
| `login_success` |
| `login_failure` |
| `logout` |
| `session_revoked` |
| `password_reset_requested` |
| `password_reset_completed` |
| `role_changed` |
| `opportunity_created` |
| `opportunity_updated` |
| `opportunity_status_changed` |
| `opportunity_published` |
| `opportunity_unpublished` |
| `opportunity_archived` |
| `lead_assigned` |
| `lead_note_added` |
| `user_suspended` |
| `user_reactivated` |
| `session_admin_revoked` |

### `lead_kind`
| Value |
|---|
| `access_request` |
| `opportunity_inquiry` |
| `general_contact` |

### `lead_status`
| Value |
|---|
| `new` |
| `in_review` |
| `contacted` |
| `qualified` |
| `closed` |
| `rejected` |

### `opportunity_media_type`
| Value |
|---|
| `image` |
| `floorplan` |
| `map` |
| `document_preview` |

### `opportunity_return_type`
| Value |
|---|
| `target_annual_return` |
| `target_total_return` |
| `target_irr` |
| `target_roi` |

### `opportunity_risk_level`
| Value |
|---|
| `low` |
| `medium` |
| `high` |
| `very_high` |

### `opportunity_status`
| Value |
|---|
| `coming_soon` |
| `open` |
| `funding` |
| `funded` |
| `in_execution` |
| `commercializing` |
| `closed` |
| `cancelled` |

### `opportunity_visibility`
| Value |
|---|
| `public` |
| `private` |
| `unlisted` |
| `draft` |

### `user_role`
| Value |
|---|
| `investor` |
| `operator` |
| `admin` |

### `user_status`
| Value |
|---|
| `pending_email_verification` |
| `active` |
| `suspended` |
| `disabled` |

---

## Triggers (1 function, 3 triggers)

### Function: `set_updated_at()`
```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
```

### Trigger assignments
| Trigger | Table | Fires |
|---|---|---|
| `set_leads_updated_at` | `leads` | BEFORE UPDATE |
| `opportunities_set_updated_at` | `opportunities` | BEFORE UPDATE |
| `users_set_updated_at` | `users` | BEFORE UPDATE |

---

## Table: `audit_events` (48 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `event_type` | `audit_event_type` (ENUM) | NOT NULL | — |
| `user_id` | `uuid` | nullable | — |
| `session_id` | `uuid` | nullable | — |
| `metadata` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `entity_type` | `text` | nullable | — |
| `entity_reference` | `text` | nullable | — |
| `summary` | `text` | nullable | — |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `audit_events_pkey` | `(id)` |
| FOREIGN KEY | `audit_events_user_id_fkey` | `user_id → users(id)` |
| FOREIGN KEY | `audit_events_session_id_fkey` | `session_id → sessions(id)` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `audit_events_pkey` | `(id)` | YES | PK |
| `audit_events_created_at_idx` | `(created_at)` | NO | |
| `audit_events_entity_type_idx` | `(entity_type)` | NO | |
| `audit_events_event_type_idx` | `(event_type)` | NO | |
| `audit_events_user_id_idx` | `(user_id)` | NO | |

### Referenced by
*(none)*

### Analysis
- `user_id` is nullable — system/anonymous events would have no user. Reasonable.
- `metadata` as JSONB is appropriate for variable-shaped audit payloads.
- `entity_type` + `entity_reference` as free text — a polymorphic association without referential integrity. Consider a composite type or separate FK columns if strong referential guarantees are needed.

---

## Table: `email_verification_tokens` (48 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL | — |
| `token_hash` | `text` | NOT NULL | — |
| `expires_at` | `timestamptz` | NOT NULL | — |
| `consumed_at` | `timestamptz` | nullable | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `email_verification_tokens_pkey` | `(id)` |
| UNIQUE | `email_verification_tokens_token_hash_key` | `(token_hash)` |
| UNIQUE | `email_verification_tokens_user_id_key` | `(user_id)` |
| FOREIGN KEY | `email_verification_tokens_user_id_fkey` | `user_id → users(id)` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `email_verification_tokens_pkey` | `(id)` | YES | PK |
| `email_verification_tokens_token_hash_key` | `(token_hash)` | YES | UNIQUE constraint |
| `email_verification_tokens_user_id_key` | `(user_id)` | YES | UNIQUE constraint |
| `email_verification_tokens_token_hash_idx` | `(token_hash)` | NO | ⚠️ REDUNDANT — UNIQUE already creates btree index |
| `email_verification_tokens_user_id_idx` | `(user_id)` | NO | ⚠️ REDUNDANT — UNIQUE already creates btree index |

### Referenced by
*(none)*

### Analysis
- **REDUNDANT INDEXES:** `token_hash_idx` is fully redundant with `token_hash_key`. `user_id_idx` is fully redundant with `user_id_key`. Drop both.
- UNIQUE on `user_id` enforces one active verification token per user — intentional design choice to prevent token flooding.

---

## Table: `lead_notes` (24 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `lead_id` | `uuid` | NOT NULL | — |
| `author_id` | `uuid` | NOT NULL | — |
| `content` | `text` | NOT NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `lead_notes_pkey` | `(id)` |
| CHECK | `lead_notes_content_check` | `length(content) <= 5000` |
| FOREIGN KEY | `lead_notes_lead_id_fkey` | `lead_id → leads(id)` |
| FOREIGN KEY | `lead_notes_author_id_fkey` | `author_id → users(id)` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `lead_notes_pkey` | `(id)` | YES | PK |
| `lead_notes_lead_id_idx` | `(lead_id)` | NO | |

### Referenced by
*(none)*

### Analysis
- **MISSING INDEX:** No index on `author_id` despite FK constraint. Add `lead_notes_author_id_idx` for queries like "all notes by a user."
- Immutable notes — no `updated_at`. Intentional design.
- Column naming: `author_id` here vs `updated_by`/`changed_by` elsewhere. Inconsistent.

---

## Table: `leads` (56 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `public_reference` | `text` | NOT NULL | — |
| `kind` | `lead_kind` (ENUM) | NOT NULL | — |
| `opportunity_id` | `uuid` | nullable | — |
| `first_name` | `text` | NOT NULL | — |
| `last_name` | `text` | NOT NULL | — |
| `email` | `text` | NOT NULL | — |
| `phone` | `text` | nullable | — |
| `country_code` | `character(2)` | nullable | — |
| `investment_range` | `text` | nullable | — |
| `message` | `text` | nullable | — |
| `status` | `lead_status` (ENUM) | NOT NULL | `'new'::lead_status` |
| `source_path` | `text` | NOT NULL | — |
| `referrer` | `text` | nullable | — |
| `utm_source` | `text` | nullable | — |
| `utm_medium` | `text` | nullable | — |
| `utm_campaign` | `text` | nullable | — |
| `privacy_policy_version` | `text` | NOT NULL | — |
| `privacy_accepted_at` | `timestamptz` | NOT NULL | — |
| `risk_acknowledged_at` | `timestamptz` | nullable | — |
| `marketing_opt_in_at` | `timestamptz` | nullable | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |
| `version` | `integer` | NOT NULL | `1` |
| `assigned_user_id` | `uuid` | nullable | — |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `leads_pkey` | `(id)` |
| UNIQUE | `leads_public_reference_key` | `(public_reference)` |
| CHECK | `leads_country_code_check` | `country_code IS NULL OR country_code ~ '^[A-Z]{2}$'` |
| CHECK | `leads_email_check` | `email = lower(email) AND char_length(email) <= 254` |
| CHECK | `leads_first_name_check` | `char_length(first_name) >= 1 AND <= 80` |
| CHECK | `leads_investment_range_check` | `investment_range IS NULL OR char_length(…) <= 80` |
| CHECK | `leads_last_name_check` | `char_length(last_name) >= 1 AND <= 120` |
| CHECK | `leads_message_check` | `message IS NULL OR char_length(…) <= 2000` |
| CHECK | `leads_phone_check` | `phone IS NULL OR char_length(…) <= 40` |
| CHECK | `leads_privacy_policy_version_check` | `char_length(…) >= 1 AND <= 40` |
| CHECK | `leads_referrer_check` | `referrer IS NULL OR char_length(…) <= 500` |
| CHECK | `leads_source_path_check` | `char_length(source_path) <= 240` |
| CHECK | `leads_utm_campaign_check` | `utm_campaign IS NULL OR char_length(…) <= 120` |
| CHECK | `leads_utm_medium_check` | `utm_medium IS NULL OR char_length(…) <= 120` |
| CHECK | `leads_utm_source_check` | `utm_source IS NULL OR char_length(…) <= 120` |
| CHECK | `opportunity_required_for_inquiry` | `(kind = 'opportunity_inquiry') = (opportunity_id IS NOT NULL)` |
| FOREIGN KEY | `leads_opportunity_id_fkey` | `opportunity_id → opportunities(id) ON DELETE SET NULL` |
| FOREIGN KEY | `leads_assigned_user_id_fkey` | `assigned_user_id → users(id)` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `leads_pkey` | `(id)` | YES | PK |
| `leads_public_reference_key` | `(public_reference)` | YES | UNIQUE |
| `leads_email_recent_idx` | `(email, created_at DESC)` | NO | |
| `leads_kind_created_at_idx` | `(kind, created_at DESC)` | NO | |
| `leads_status_created_at_idx` | `(status, created_at DESC)` | NO | |
| `leads_opportunity_id_idx` | `(opportunity_id) WHERE opportunity_id IS NOT NULL` | NO | Partial index |

### Triggers
| Trigger | Fires |
|---|---|
| `set_leads_updated_at` | BEFORE UPDATE → `set_updated_at()` |

### Referenced by
- `lead_notes.lead_id → leads(id)`

### Analysis
- Excellent CHECK constraints — thorough input validation at DB level.
- Partial index `leads_opportunity_id_idx` is well-designed.
- `version` column present but no `opportunity_versions`-style versioning table for leads. Possibly reserved for future use.
- `country_code` uses `character(2)` (fixed-length) which pads with spaces. Prefer `text` or `varchar(2)`.

---

## Table: `opportunities` (64 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `slug` | `text` | NOT NULL | — |
| `title` | `text` | NOT NULL | — |
| `short_description` | `text` | NOT NULL | — |
| `description` | `text` | NOT NULL | — |
| `city` | `text` | NOT NULL | — |
| `country_code` | `character(2)` | NOT NULL | — |
| `district` | `text` | nullable | — |
| `asset_type` | `text` | NOT NULL | — |
| `strategy` | `text` | NOT NULL | — |
| `status` | `opportunity_status` (ENUM) | NOT NULL | — |
| `visibility` | `opportunity_visibility` (ENUM) | NOT NULL | `'draft'::opportunity_visibility` |
| `currency` | `character(3)` | NOT NULL | — |
| `target_amount_cents` | `bigint` | NOT NULL | — |
| `committed_amount_cents` | `bigint` | NOT NULL | `0` |
| `minimum_investment_cents` | `bigint` | NOT NULL | — |
| `estimated_term_months` | `integer` | NOT NULL | — |
| `target_return_type` | `opportunity_return_type` (ENUM) | NOT NULL | — |
| `target_return_bps` | `integer` | nullable | — |
| `risk_level` | `opportunity_risk_level` (ENUM) | NOT NULL | — |
| `closing_date` | `date` | nullable | — |
| `published_at` | `timestamptz` | nullable | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |
| `version` | `integer` | NOT NULL | `1` |
| `editorial_status` | `text` | NOT NULL | `'draft'::text` |
| `updated_by` | `uuid` | nullable | — |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `opportunities_pkey` | `(id)` |
| UNIQUE | `opportunities_slug_key` | `(slug)` |
| CHECK | `opportunities_committed_amount_cents_check` | `committed_amount_cents >= 0` |
| CHECK | `opportunities_committed_not_extreme` | `committed_amount_cents <= target_amount_cents * 2` |
| CHECK | `opportunities_country_code_check` | `country_code ~ '^[A-Z]{2}$'` |
| CHECK | `opportunities_currency_check` | `currency ~ '^[A-Z]{3}$'` |
| CHECK | `opportunities_editorial_status_check` | `IN ('draft','review','published','unlisted','private','archived')` |
| CHECK | `opportunities_estimated_term_months_check` | `estimated_term_months > 0` |
| CHECK | `opportunities_minimum_investment_cents_check` | `minimum_investment_cents > 0` |
| CHECK | `opportunities_target_amount_cents_check` | `target_amount_cents > 0` |
| CHECK | `opportunities_target_return_bps_check` | `target_return_bps IS NULL OR >= 0` |
| FOREIGN KEY | `opportunities_updated_by_fkey` | `updated_by → users(id)` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `opportunities_pkey` | `(id)` | YES | PK |
| `opportunities_slug_key` | `(slug)` | YES | UNIQUE |
| `opportunities_public_catalog_idx` | `(visibility, published_at DESC, status, city, asset_type, strategy, risk_level)` | NO | Composite |

### Triggers
| Trigger | Fires |
|---|---|
| `opportunities_set_updated_at` | BEFORE UPDATE → `set_updated_at()` |

### Referenced by
- `leads.opportunity_id → opportunities(id) ON DELETE SET NULL`
- `opportunity_highlights.opportunity_id → opportunities(id) ON DELETE CASCADE`
- `opportunity_media.opportunity_id → opportunities(id) ON DELETE CASCADE`
- `opportunity_milestones.opportunity_id → opportunities(id) ON DELETE CASCADE`
- `opportunity_risks.opportunity_id → opportunities(id) ON DELETE CASCADE`
- `opportunity_versions.opportunity_id → opportunities(id)` (NO cascade)

### Analysis
- **Anti-pattern:** `editorial_status` is `text` with a CHECK constraint enumerating 6 values. Should be a proper ENUM type (`opportunity_editorial_status`) for consistency with other status/type columns.
- **Anti-pattern:** `asset_type` and `strategy` are free-form `text`. If the domain has a fixed set of values, these should be ENUMs or reference tables with FK constraints.
- `country_code` uses `character(2)` — same note as leads about padding.
- `currency` as `character(3)` — reasonable for ISO 4217 codes.
- Monetary values in cents (`bigint`) — good practice.
- `committed_not_extreme` CHECK allows up to 2× target — sensible overfunding guard.
- Composite catalog index is well-optimized for public-facing listing queries.
- `version` column tracked, with actual version snapshots in `opportunity_versions`.

---

## Table: `opportunity_highlights` (48 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `opportunity_id` | `uuid` | NOT NULL | — |
| `label` | `text` | NOT NULL | — |
| `value` | `text` | NOT NULL | — |
| `position` | `integer` | NOT NULL | `0` |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `opportunity_highlights_pkey` | `(id)` |
| UNIQUE | `opportunity_highlights_opportunity_id_position_label_key` | `(opportunity_id, position, label)` |
| CHECK | `opportunity_highlights_position_check` | `position >= 0` |
| FOREIGN KEY | `opportunity_highlights_opportunity_id_fkey` | `opportunity_id → opportunities(id) ON DELETE CASCADE` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `opportunity_highlights_pkey` | `(id)` | YES | PK |
| `opportunity_highlights_opportunity_id_position_label_key` | `(opportunity_id, position, label)` | YES | UNIQUE |

### Referenced by
*(none)*

### Analysis
- Clean, no issues. The UNIQUE constraint on `(opportunity_id, position, label)` also serves as the index for FK lookups.

---

## Table: `opportunity_media` (48 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `opportunity_id` | `uuid` | NOT NULL | — |
| `type` | `opportunity_media_type` (ENUM) | NOT NULL | — |
| `url` | `text` | NOT NULL | — |
| `alt_text` | `text` | NOT NULL | — |
| `position` | `integer` | NOT NULL | `0` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `opportunity_media_pkey` | `(id)` |
| UNIQUE | `opportunity_media_opportunity_id_position_url_key` | `(opportunity_id, position, url)` |
| CHECK | `opportunity_media_position_check` | `position >= 0` |
| FOREIGN KEY | `opportunity_media_opportunity_id_fkey` | `opportunity_id → opportunities(id) ON DELETE CASCADE` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `opportunity_media_pkey` | `(id)` | YES | PK |
| `opportunity_media_opportunity_id_position_url_key` | `(opportunity_id, position, url)` | YES | UNIQUE |

### Referenced by
*(none)*

### Analysis
- Clean. No `updated_at` — media entries are immutable or replaced wholesale.
- `alt_text` is NOT NULL but could be empty string. Consider a CHECK for non-empty or making it nullable if truly optional.

---

## Table: `opportunity_milestones` (48 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `opportunity_id` | `uuid` | NOT NULL | — |
| `title` | `text` | NOT NULL | — |
| `description` | `text` | NOT NULL | — |
| `planned_date` | `date` | nullable | — |
| `completed_at` | `timestamptz` | nullable | — |
| `position` | `integer` | NOT NULL | `0` |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `opportunity_milestones_pkey` | `(id)` |
| UNIQUE | `opportunity_milestones_opportunity_id_position_title_key` | `(opportunity_id, position, title)` |
| CHECK | `opportunity_milestones_position_check` | `position >= 0` |
| FOREIGN KEY | `opportunity_milestones_opportunity_id_fkey` | `opportunity_id → opportunities(id) ON DELETE CASCADE` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `opportunity_milestones_pkey` | `(id)` | YES | PK |
| `opportunity_milestones_opportunity_id_position_title_key` | `(opportunity_id, position, title)` | YES | UNIQUE |

### Referenced by
*(none)*

### Analysis
- Clean. No `updated_at` — milestones are edited in-place or versioned at the opportunity level.

---

## Table: `opportunity_risks` (48 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `opportunity_id` | `uuid` | NOT NULL | — |
| `title` | `text` | NOT NULL | — |
| `description` | `text` | NOT NULL | — |
| `position` | `integer` | NOT NULL | `0` |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `opportunity_risks_pkey` | `(id)` |
| UNIQUE | `opportunity_risks_opportunity_id_position_title_key` | `(opportunity_id, position, title)` |
| CHECK | `opportunity_risks_position_check` | `position >= 0` |
| FOREIGN KEY | `opportunity_risks_opportunity_id_fkey` | `opportunity_id → opportunities(id) ON DELETE CASCADE` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `opportunity_risks_pkey` | `(id)` | YES | PK |
| `opportunity_risks_opportunity_id_position_title_key` | `(opportunity_id, position, title)` | YES | UNIQUE |

### Referenced by
*(none)*

### Analysis
- Clean. Structurally identical to `opportunity_highlights` (label/value vs title/description).

---

## Table: `opportunity_versions` (32 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `opportunity_id` | `uuid` | NOT NULL | — |
| `version` | `integer` | NOT NULL | — |
| `snapshot` | `jsonb` | NOT NULL | — |
| `changed_by` | `uuid` | nullable | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `opportunity_versions_pkey` | `(id)` |
| UNIQUE | `opportunity_versions_opportunity_id_version_key` | `(opportunity_id, version)` |
| FOREIGN KEY | `opportunity_versions_opportunity_id_fkey` | `opportunity_id → opportunities(id)` |
| FOREIGN KEY | `opportunity_versions_changed_by_fkey` | `changed_by → users(id)` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `opportunity_versions_pkey` | `(id)` | YES | PK |
| `opportunity_versions_opportunity_id_version_key` | `(opportunity_id, version)` | YES | UNIQUE |
| `opportunity_versions_opp_id_idx` | `(opportunity_id)` | NO | ⚠️ REDUNDANT — UNIQUE already creates btree index on `(opportunity_id, version)` which serves `opportunity_id` lookups |

### Referenced by
*(none)*

### Analysis
- **REDUNDANT INDEX:** `opp_id_idx` on `(opportunity_id)` is fully redundant. The UNIQUE constraint index on `(opportunity_id, version)` already covers queries filtering by `opportunity_id` alone (btree leftmost column). Drop it.
- `changed_by` is nullable — if this is for system-initiated version bumps, that's reasonable.
- Column naming: `changed_by` here vs `updated_by` in `opportunities`. Inconsistent.
- `snapshot` as JSONB is appropriate for version snapshots.

---

## Table: `password_reset_tokens` (48 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL | — |
| `token_hash` | `text` | NOT NULL | — |
| `expires_at` | `timestamptz` | NOT NULL | — |
| `consumed_at` | `timestamptz` | nullable | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `password_reset_tokens_pkey` | `(id)` |
| UNIQUE | `password_reset_tokens_token_hash_key` | `(token_hash)` |
| UNIQUE | `password_reset_tokens_user_id_key` | `(user_id)` |
| FOREIGN KEY | `password_reset_tokens_user_id_fkey` | `user_id → users(id)` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `password_reset_tokens_pkey` | `(id)` | YES | PK |
| `password_reset_tokens_token_hash_key` | `(token_hash)` | YES | UNIQUE constraint |
| `password_reset_tokens_user_id_key` | `(user_id)` | YES | UNIQUE constraint |
| `password_reset_tokens_token_hash_idx` | `(token_hash)` | NO | ⚠️ REDUNDANT — UNIQUE already creates btree index |
| `password_reset_tokens_user_id_idx` | `(user_id)` | NO | ⚠️ REDUNDANT — UNIQUE already creates btree index |

### Referenced by
*(none)*

### Analysis
- Identical structure to `email_verification_tokens` — same redundancy issues.
- **REDUNDANT INDEXES:** Both `token_hash_idx` and `user_id_idx` are fully redundant. Drop both.
- UNIQUE on `user_id` enforces one active reset token per user.

---

## Table: `schema_migrations` (32 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `text` | NOT NULL | — |
| `checksum` | `text` | NOT NULL | — |
| `applied_at` | `timestamptz` | NOT NULL | `now()` |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `schema_migrations_pkey` | `(id)` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `schema_migrations_pkey` | `(id)` | YES | PK |

### Referenced by
*(none)*

### Analysis
- Standard migration tracking table. No issues.

---

## Table: `sessions` (48 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL | — |
| `token_hash` | `text` | NOT NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `expires_at` | `timestamptz` | NOT NULL | — |
| `last_seen_at` | `timestamptz` | NOT NULL | `now()` |
| `revoked_at` | `timestamptz` | nullable | — |
| `user_agent_hash` | `text` | nullable | — |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `sessions_pkey` | `(id)` |
| UNIQUE | `sessions_token_hash_key` | `(token_hash)` |
| CHECK | `sessions_revoked_after_created` | `revoked_at IS NULL OR revoked_at > created_at` |
| FOREIGN KEY | `sessions_user_id_fkey` | `user_id → users(id)` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `sessions_pkey` | `(id)` | YES | PK |
| `sessions_token_hash_key` | `(token_hash)` | YES | UNIQUE |
| `sessions_token_hash_idx` | `(token_hash)` | NO | ⚠️ REDUNDANT — UNIQUE already creates btree index |
| `sessions_user_id_idx` | `(user_id)` | NO | |
| `sessions_expires_at_idx` | `(expires_at)` | NO | For session cleanup queries |

### Referenced by
- `audit_events.session_id → sessions(id)`

### Analysis
- **REDUNDANT INDEX:** `sessions_token_hash_idx` is redundant with `sessions_token_hash_key`. Drop it.
- `sessions_user_id_idx` is useful (not covered by UNIQUE on token_hash) — keep.
- `sessions_expires_at_idx` is useful for periodic cleanup jobs — keep.
- `user_agent_hash` — storing hash of user agent for privacy/security. No index needed unless querying for audit purposes.

---

## Table: `user_roles` (16 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL | — |
| `role` | `user_role` (ENUM) | NOT NULL | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `user_roles_pkey` | `(id)` |
| UNIQUE | `user_roles_user_id_role_key` | `(user_id, role)` |
| FOREIGN KEY | `user_roles_user_id_fkey` | `user_id → users(id)` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `user_roles_pkey` | `(id)` | YES | PK |
| `user_roles_user_id_role_key` | `(user_id, role)` | YES | UNIQUE |

### Referenced by
*(none)*

### Analysis
- Clean. UNIQUE on `(user_id, role)` covers FK lookups. No redundant indexes.

---

## Table: `users` (40 kB)

### Columns
| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` |
| `public_reference` | `text` | NOT NULL | — |
| `email` | `text` | NOT NULL | — |
| `email_normalized` | `text` | NOT NULL | — |
| `password_hash` | `text` | nullable | — |
| `email_verified_at` | `timestamptz` | nullable | — |
| `status` | `user_status` (ENUM) | NOT NULL | `'pending_email_verification'::user_status` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |
| `last_login_at` | `timestamptz` | nullable | — |
| `version` | `integer` | NOT NULL | `1` |
| `name` | `text` | nullable | — |

### Constraints
| Type | Name | Definition |
|---|---|---|
| PRIMARY KEY | `users_pkey` | `(id)` |
| UNIQUE | `users_email_key` | `(email)` |
| UNIQUE | `users_email_normalized_key` | `(email_normalized)` |
| UNIQUE | `users_public_reference_key` | `(public_reference)` |
| CHECK | `users_email_length_check` | `length(email) >= 5 AND <= 254` |
| CHECK | `users_email_normalized_check` | `email_normalized = lower(TRIM(BOTH FROM email))` |
| CHECK | `users_password_hash_length_check` | `length(password_hash) <= 512` |

### Indexes
| Name | Columns | Unique | Notes |
|---|---|---|---|
| `users_pkey` | `(id)` | YES | PK |
| `users_email_key` | `(email)` | YES | UNIQUE |
| `users_email_normalized_key` | `(email_normalized)` | YES | UNIQUE |
| `users_public_reference_key` | `(public_reference)` | YES | UNIQUE |

### Triggers
| Trigger | Fires |
|---|---|
| `users_set_updated_at` | BEFORE UPDATE → `set_updated_at()` |

### Referenced by
- `audit_events.user_id → users(id)`
- `email_verification_tokens.user_id → users(id)`
- `lead_notes.author_id → users(id)`
- `leads.assigned_user_id → users(id)`
- `opportunities.updated_by → users(id)`
- `opportunity_versions.changed_by → users(id)`
- `password_reset_tokens.user_id → users(id)`
- `sessions.user_id → users(id)`
- `user_roles.user_id → users(id)`

### Analysis
- Dual uniqueness on `email` and `email_normalized` — robust against case/collation issues.
- `password_hash` is nullable — supports users who haven't set a password (e.g., SSO-only users or pending-verification users).
- `name` is nullable — users may register with email only; name added later.
- `email_normalized_check` guarantees consistency between raw and normalized email.

---

## Cross-Table Relationship Diagram

```
users
 ├──< audit_events (user_id, session_id via sessions)
 ├──< email_verification_tokens (user_id)
 ├──< lead_notes (author_id)
 ├──< leads (assigned_user_id)
 ├──< opportunities (updated_by)
 ├──< opportunity_versions (changed_by)
 ├──< password_reset_tokens (user_id)
 ├──< sessions (user_id)
 └──< user_roles (user_id)

sessions
 └──< audit_events (session_id)

opportunities
 ├──< leads (opportunity_id, ON DELETE SET NULL)
 ├──< opportunity_highlights (opportunity_id, ON DELETE CASCADE)
 ├──< opportunity_media (opportunity_id, ON DELETE CASCADE)
 ├──< opportunity_milestones (opportunity_id, ON DELETE CASCADE)
 ├──< opportunity_risks (opportunity_id, ON DELETE CASCADE)
 └──< opportunity_versions (opportunity_id, NO CASCADE)

leads
 └──< lead_notes (lead_id)
```

---

## Issues & Recommendations Summary

### 🔴 Redundant Indexes (should be dropped)
These indexes duplicate the btree index already created by a UNIQUE constraint on the same column:

| Table | Redundant Index | Covered By |
|---|---|---|
| `email_verification_tokens` | `email_verification_tokens_token_hash_idx` | `email_verification_tokens_token_hash_key` (UNIQUE) |
| `email_verification_tokens` | `email_verification_tokens_user_id_idx` | `email_verification_tokens_user_id_key` (UNIQUE) |
| `password_reset_tokens` | `password_reset_tokens_token_hash_idx` | `password_reset_tokens_token_hash_key` (UNIQUE) |
| `password_reset_tokens` | `password_reset_tokens_user_id_idx` | `password_reset_tokens_user_id_key` (UNIQUE) |
| `sessions` | `sessions_token_hash_idx` | `sessions_token_hash_key` (UNIQUE) |
| `opportunity_versions` | `opportunity_versions_opp_id_idx` | `opportunity_versions_opportunity_id_version_key` (UNIQUE, leftmost column) |

**Total removable: 6 indexes** — saving storage and write overhead with zero query impact.

### 🟡 Missing Indexes
| Table | Missing Index | Reason |
|---|---|---|
| `lead_notes` | `lead_notes_author_id_idx` ON `(author_id)` | FK to users; needed for "notes by author" queries |

### 🟠 Column Naming Inconsistencies
| Issue | Tables |
|---|---|
| `updated_by` vs `changed_by` | `opportunities.updated_by` vs `opportunity_versions.changed_by` — both mean "user who made the change." Standardize on one. |
| `author_id` vs `updated_by`/`changed_by` | `lead_notes.author_id` follows a different naming convention than the "X_by" pattern. |

### 🟠 Anti-Patterns
| Issue | Detail |
|---|---|
| `editorial_status` as `text` + CHECK | `opportunities.editorial_status` is `text` with a CHECK constraint enumerating 6 values. Should be an ENUM type (`opportunity_editorial_status`) like every other status/type column in the schema. |
| `asset_type` / `strategy` as free `text` | Both are NOT NULL `text` with no CHECK constraints. If these have a known set of values, use ENUMs or reference tables. Free text invites inconsistency. |
| `country_code` as `character(2)` | Fixed-length `character(n)` pads with spaces and has surprising comparison semantics. Prefer `text` with a CHECK constraint (already present). |

### 🟢 Potential Missing NOT NULL
| Column | Current | Consideration |
|---|---|---|
| `audit_events.user_id` | nullable | System events may legitimately have no user. OK as-is. |
| `audit_events.entity_type` | nullable | If every auditable event should reference an entity, make NOT NULL. |
| `opportunity_versions.changed_by` | nullable | System/migration-initiated versions may have no user. OK as-is. |
| `users.name` | nullable | Users may register with email only. OK as-is. |

### 🟢 JSONB Usage (justified)
| Table.Column | Verdict |
|---|---|
| `audit_events.metadata` | ✅ Appropriate — variable audit payload shapes |
| `opportunity_versions.snapshot` | ✅ Appropriate — full row snapshots for versioning |

### 🟢 Artificial Defaults (acceptable)
| Table.Column | Default | Verdict |
|---|---|---|
| `leads.version` | `1` | ✅ Standard optimistic concurrency pattern |
| `opportunities.version` | `1` | ✅ Same |
| `users.version` | `1` | ✅ Same |
| `audit_events.metadata` | `'{}'::jsonb` | ✅ Ensures valid JSONB even for events with no metadata |
| `opportunity_highlights.position` | `0` | ✅ Reasonable default for ordered lists |
| `opportunity_media.position` | `0` | ✅ Same |
| `opportunity_milestones.position` | `0` | ✅ Same |
| `opportunity_risks.position` | `0` | ✅ Same |
| `opportunities.committed_amount_cents` | `0` | ✅ New opportunities start with $0 committed |
