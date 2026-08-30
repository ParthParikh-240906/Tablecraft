-- AI-assisted restaurant theming at signup.
-- Adds 4 nullable columns to organizations for the AI-generated "skin".
-- All nullable: signup never breaks if AI fails/times out or description is blank.
alter table public.organizations
  add column theme_secondary_color text,
  add column theme_font_pair       text,
  add column theme_motif           text,
  add column tagline               text;