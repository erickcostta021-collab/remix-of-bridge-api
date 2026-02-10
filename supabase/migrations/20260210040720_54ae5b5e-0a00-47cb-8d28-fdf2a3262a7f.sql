ALTER TABLE public.ghl_subaccounts
ADD COLUMN skip_outbound boolean NOT NULL DEFAULT false;