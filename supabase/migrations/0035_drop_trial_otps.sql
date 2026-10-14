-- 0035: drop the phone-OTP free-trial table (OTP verification removed).
-- Nothing in the app reads trial_otps anymore; quotas live in
-- owner_usage_monthly / owner_quota_warnings (see 0034).

drop table if exists public.trial_otps;
