import type Stripe from "stripe";

/**
 * Stripe Connect helpers (Accounts v2).
 *
 * Tablecraft uses destination charges: the platform is the merchant of record
 * and each restaurant only needs the recipient configuration to receive
 * transfers. Accounts v1 is no longer accepted by Stripe for new Connect
 * integrations, so account creation and onboarding links use the v2 API.
 */

export type ConnectStatus = "none" | "pending" | "active" | "restricted";

/** Country where the restaurant's Stripe account is registered. */
export const CONNECT_COUNTRY = process.env.STRIPE_CONNECT_COUNTRY?.trim() || "AE";

export function connectStatusFromAccount(
  account: Stripe.V2.Core.Account,
): ConnectStatus {
  const transfers =
    account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers;
  const capabilityStatus = transfers?.status;

  if (capabilityStatus === "active") return "active";

  const deadline = account.requirements?.summary?.minimum_deadline?.status;
  const hasErrors =
    account.requirements?.entries?.some(
      (entry) => (entry.errors?.length ?? 0) > 0,
    ) ?? false;

  if (
    capabilityStatus === "restricted" ||
    capabilityStatus === "unsupported" ||
    deadline === "past_due" ||
    hasErrors
  ) {
    return "restricted";
  }

  return "pending";
}

/** Retrieve a Connect account with the fields needed to compute its status. */
export async function retrieveConnectStatus(
  stripe: Stripe,
  accountId: string,
): Promise<ConnectStatus> {
  try {
    const account = await stripe.v2.core.accounts.retrieve(accountId, {
      include: ["configuration.recipient", "requirements"],
    });
    return connectStatusFromAccount(account);
  } catch (err) {
    // Accounts created before the v2 migration use the v1 API. Retrieval still
    // works for them, so keep their status reporting accurate.
    try {
      const legacy = await stripe.accounts.retrieve(accountId);
      return legacy.details_submitted && legacy.charges_enabled
        ? "active"
        : legacy.requirements?.disabled_reason
          ? "restricted"
          : "pending";
    } catch {
      throw err;
    }
  }
}

/** Create a recipient-only Express account for a restaurant. */
export function createConnectAccount(
  stripe: Stripe,
  params: {
    name: string;
    email?: string | null;
    orgId: string;
    orgSlug: string;
    country?: string;
  },
): Promise<Stripe.V2.Core.Account> {
  return stripe.v2.core.accounts.create({
    display_name: params.name,
    contact_email: params.email || undefined,
    dashboard: "express",
    identity: { country: params.country ?? CONNECT_COUNTRY },
    defaults: {
      locales: ["en"],
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: { stripe_transfers: { requested: true } },
        },
      },
    },
    metadata: { orgId: params.orgId, orgSlug: params.orgSlug },
  });
}

/**
 * Turn a Stripe SDK error into a message an owner can act on. Stripe's raw
 * messages are already specific, but a couple of configuration failures have
 * a clear next step we can spell out.
 */
export function describeStripeError(err: unknown): string {
  const message =
    err instanceof Error ? err.message.trim() : String(err ?? "").trim();

  if (/signed up for Connect/i.test(message)) {
    return "Stripe Connect is not enabled on this Stripe account yet. Enable it at https://dashboard.stripe.com/connect and try again.";
  }
  if (/Accounts v1/i.test(message)) {
    return "Stripe requires Accounts v2 for new Connect accounts. Update the integration and try again.";
  }
  if (/No such account/i.test(message)) {
    return "The saved Stripe account no longer exists. Contact support so we can reset it, then try again.";
  }

  return message || "Could not start Stripe onboarding.";
}
