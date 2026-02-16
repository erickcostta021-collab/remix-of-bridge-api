
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS webhook_inbound_url text,
ADD COLUMN IF NOT EXISTS webhook_outbound_url text;
