/**
 * lib/vercel-domains.ts — server-only Vercel Domains API wrapper.
 *
 * Uses plain fetch so the project needs no extra dependency. Never import this
 * from a client component; VERCEL_TOKEN is server-only.
 */

const API = "https://api.vercel.com";

export class VercelDomainError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "VercelDomainError";
    this.code = code;
    this.status = status;
  }
}

export type VercelVerification = {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
};

export type VercelProjectDomain = {
  name: string;
  verified?: boolean;
  verification?: VercelVerification[];
  error?: { code?: string; message?: string } | null;
  redirect?: string | null;
  redirectStatusCode?: number | null;
};

export type VercelDomainConfig = {
  misconfigured?: boolean;
  recommendedIPv4?: string[];
  recommendedCNAME?: string[];
  configuredBy?: string | null;
};

export function isVercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function teamQuery(): string {
  const team = process.env.VERCEL_TEAM_ID;
  return team ? `teamId=${encodeURIComponent(team)}` : "";
}

function withTeam(path: string): string {
  const q = teamQuery();
  if (!q) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${q}`;
}

async function vercelFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!isVercelConfigured()) {
    throw new VercelDomainError(
      "Domain management is not configured.",
      "not_configured",
      503,
    );
  }

  const url = `${API}${withTeam(path)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch (err) {
    console.error("vercelFetch network error:", err);
    throw new VercelDomainError("Vercel is unavailable right now.", "vercel_unavailable", 502);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const body = data as { error?: { code?: string; message?: string }; message?: string } | null;
    const code = body?.error?.code || `http_${res.status}`;
    const message = body?.error?.message || body?.message || "Vercel request failed.";
    console.error(`Vercel API ${res.status} ${path}: ${message}`);
    throw new VercelDomainError(message, code, res.status);
  }

  return data as T;
}

function projectPath(suffix: string): string {
  const project = process.env.VERCEL_PROJECT_ID;
  return `/v10/projects/${encodeURIComponent(project ?? "")}${suffix}`;
}

function projectDomainPath(hostname: string): string {
  return `/v9/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID ?? "")}/domains/${encodeURIComponent(hostname)}`;
}

export async function addProjectDomain(hostname: string): Promise<VercelProjectDomain> {
  return vercelFetch<VercelProjectDomain>(projectPath("/domains"), {
    method: "POST",
    body: JSON.stringify({ name: hostname }),
  });
}

export async function getProjectDomain(hostname: string): Promise<VercelProjectDomain | null> {
  try {
    return await vercelFetch<VercelProjectDomain>(projectDomainPath(hostname));
  } catch (err) {
    if (err instanceof VercelDomainError && (err.status === 404 || err.code === "not_found")) {
      return null;
    }
    throw err;
  }
}

export async function verifyProjectDomain(hostname: string): Promise<VercelProjectDomain> {
  return vercelFetch<VercelProjectDomain>(`${projectDomainPath(hostname)}/verify`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function setProjectDomainRedirect(
  hostname: string,
  redirectTo: string,
): Promise<VercelProjectDomain> {
  return vercelFetch<VercelProjectDomain>(projectDomainPath(hostname), {
    method: "PATCH",
    body: JSON.stringify({ redirect: redirectTo, redirectStatusCode: 308 }),
  });
}

export async function removeProjectDomain(hostname: string): Promise<void> {
  try {
    await vercelFetch<unknown>(projectDomainPath(hostname), { method: "DELETE" });
  } catch (err) {
    if (err instanceof VercelDomainError && err.status === 404) return;
    throw err;
  }
}

export async function getDomainConfig(hostname: string): Promise<VercelDomainConfig | null> {
  try {
    return await vercelFetch<VercelDomainConfig>(
      `/v6/domains/${encodeURIComponent(hostname)}/config`,
    );
  } catch (err) {
    if (err instanceof VercelDomainError && err.status === 404) return null;
    throw err;
  }
}

/** Count every hostname attached to the project (Hobby cap = 50). */
export async function listProjectDomains(): Promise<Array<{ name: string }>> {
  const out: Array<{ name: string }> = [];
  let until: string | undefined;
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (until) qs.set("until", until);
    const data = await vercelFetch<{
      domains?: Array<{ name?: string }>;
      pagination?: { next?: string | number | null };
    }>(`/v9/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID ?? "")}/domains?${qs.toString()}`);
    for (const d of data.domains ?? []) {
      if (typeof d.name === "string") out.push({ name: d.name });
    }
    const next = data.pagination?.next;
    if (next === undefined || next === null || next === "") break;
    until = String(next);
  }
  return out;
}

export async function getProjectDomainCount(): Promise<number> {
  return (await listProjectDomains()).length;
}

/** Friendly, non-leaky error for the API/UI. */
export function domainErrorMessage(err: unknown): { error: string; code: string } {
  if (err instanceof VercelDomainError) {
    if (err.code === "not_configured") {
      return { error: "Domain management is not configured yet.", code: err.code };
    }
    if (err.code === "domain_already_in_use" || err.status === 409) {
      return {
        error: "This domain is already in use. Follow the TXT verification record to prove ownership.",
        code: "domain_in_use",
      };
    }
    if (err.status === 403) {
      return { error: "Domain management is temporarily unavailable.", code: "forbidden" };
    }
    if (err.status === 429) {
      return { error: "Too many domain requests. Try again shortly.", code: "rate_limited" };
    }
    return { error: "Vercel could not process this domain. Try again shortly.", code: err.code };
  }
  return { error: "Could not update the domain. Try again shortly.", code: "unknown" };
}
