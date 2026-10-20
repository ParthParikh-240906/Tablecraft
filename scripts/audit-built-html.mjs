/**
 * scripts/audit-built-html.mjs
 *
 * Find AI-built sites whose stored built_html is truncated or syntactically
 * broken. These are the rows that produce a page where every button is dead.
 *
 * Usage:
 *   node scripts/audit-built-html.mjs                # report only
 *   node scripts/audit-built-html.mjs --null-invalid # clear broken built_html
 *
 * Clearing built_html is safe: the public page falls back to the
 * settings-driven design renderer instead of serving a broken iframe. Rebuild
 * the site afterwards with the AI build flow.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const nullInvalid = process.argv.includes("--null-invalid");
const supabase = createClient(supabaseUrl, serviceKey);

function validate(html) {
  const errors = [];
  if (!/<\/html\s*>/i.test(html)) errors.push("missing </html>");
  if (!/<\/body\s*>/i.test(html)) errors.push("missing </body>");

  const opens = (html.match(/<script(?=[\s>])/gi) ?? []).length;
  const closes = (html.match(/<\/script\s*>/gi) ?? []).length;
  if (opens !== closes) errors.push(`unbalanced script tags ${opens}/${closes}`);

  if (opens === closes) {
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
      if (/\bsrc\s*=/i.test(match[1] ?? "")) continue;
      try {
        new Function(match[2]);
      } catch (e) {
        errors.push(`script syntax: ${e.message}`);
        break;
      }
    }
  }
  return errors;
}

const { data: orgs, error } = await supabase
  .from("organizations")
  .select("id, slug, design_settings")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

let invalid = 0;
for (const org of orgs ?? []) {
  const html = org.design_settings?.built_html;
  if (typeof html !== "string" || !html) continue;
  const errors = validate(html);
  if (errors.length === 0) continue;
  invalid += 1;
  console.log(`${org.slug}: ${html.length} chars — ${errors.join(" | ")}`);
  if (!nullInvalid) continue;

  const settings = { ...(org.design_settings ?? {}) };
  delete settings.built_html;
  const { error: updateError } = await supabase
    .from("organizations")
    .update({ design_settings: settings })
    .eq("id", org.id);
  if (updateError) console.error(`  clear failed: ${updateError.message}`);
}

console.log(
  `\n${invalid} invalid built_html row(s).` +
    (nullInvalid ? " Broken rows were cleared." : " Re-run with --null-invalid to clear them."),
);
