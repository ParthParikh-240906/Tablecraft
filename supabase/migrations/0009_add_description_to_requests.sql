-- Add human-readable description to customization requests
-- This stores the plain-language explanation of what the change does

alter table public.customization_requests
  add column if not exists description text;

-- Add a column to store the AI-generated preview HTML
alter table public.customization_requests
  add column if not exists preview_html text;

-- Add a column to store the raw user request text
alter table public.customization_requests
  add column if not exists user_request_text text;

-- Add columns for the human/agent review gate
alter table public.customization_requests
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamp with time zone;
