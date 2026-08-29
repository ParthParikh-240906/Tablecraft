// Realtime smoke test — verifies the `tables` channel works against the hosted project.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const anon = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRole = get("SUPABASE_SERVICE_ROLE_KEY");

const anonClient = createClient(url, anon);
const adminClient = createClient(url, serviceRole, { auth: { persistSession: false } });

const { data: org } = await adminClient.from("organizations").select("id").eq("slug", "demo-diner").single();
const orgId = org.id;

const { data: table } = await adminClient.from("tables").select("id, status").eq("org_id", orgId).eq("status", "open").limit(1).single();
const tableId = table.id;
const originalStatus = table.status;
const newStatus = originalStatus === "open" ? "reserved" : "open";

console.log(`Subscribing to tables channel for org ${orgId}...`);
console.log(`Will flip table ${tableId} from ${originalStatus} -> ${newStatus}`);

const received = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("TIMEOUT: no realtime event received in 10s")), 10000);

  const channel = anonClient
    .channel("smoke-test")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tables", filter: `org_id=eq.${orgId}` }, (payload) => {
      clearTimeout(timeout);
      console.log("REALTIME EVENT RECEIVED:", JSON.stringify(payload.new));
      resolve(payload.new);
      anonClient.removeChannel(channel);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        console.log("Channel SUBSCRIBED");
        await adminClient.from("tables").update({ status: newStatus }).eq("id", tableId);
        console.log("Triggered status change via service-role");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        reject(new Error(`Channel failed: ${status}`));
      }
    });
});

try {
  await received;
  await adminClient.from("tables").update({ status: originalStatus }).eq("id", tableId);
  console.log("Restored original status. Smoke test PASSED.");
  process.exit(0);
} catch (e) {
  console.error("Smoke test FAILED:", e.message);
  process.exit(1);
}