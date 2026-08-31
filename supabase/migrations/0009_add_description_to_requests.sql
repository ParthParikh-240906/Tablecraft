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
