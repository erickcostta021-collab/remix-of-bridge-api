-- ============================================================
-- BRIDGE API - Script Incremental de Atualização
-- Aplica diferenças do Lovable Cloud no Supabase externo
-- Gerado em: 2026-02-16
-- ============================================================

-- 1. ENUM (criar apenas se não existir)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. NOVA TABELA: user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL
);

-- 3. NOVAS COLUNAS em user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS webhook_inbound_url TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS webhook_outbound_url TEXT;

-- 4. FUNÇÕES (CREATE OR REPLACE - sempre atualiza)

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.get_admin_oauth_credentials()
RETURNS TABLE(ghl_client_id text, ghl_client_secret text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin() AND current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: admin or service role required';
  END IF;
  RETURN QUERY
  SELECT us.ghl_client_id, us.ghl_client_secret
  FROM public.user_settings us
  INNER JOIN public.user_roles ur ON ur.user_id = us.user_id
  WHERE ur.role = 'admin'
    AND us.ghl_client_id IS NOT NULL AND us.ghl_client_secret IS NOT NULL
  ORDER BY us.created_at ASC LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_processed_messages()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin() AND current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM public.ghl_processed_messages WHERE created_at < now() - INTERVAL '1 hour';
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_phone_mappings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin() AND current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM public.ghl_contact_phone_mapping WHERE updated_at < now() - INTERVAL '30 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_metrics()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin() AND current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM public.webhook_metrics
  WHERE created_at < now() - INTERVAL '12 hours'
    AND (error_type IS NULL OR error_type = 'success');
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_health_alerts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin() AND current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM public.server_health_alerts WHERE status = 'recovered' AND resolved_at < now() - INTERVAL '30 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_message_mappings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin() AND current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM public.message_map WHERE created_at < now() - INTERVAL '24 hours';
END;
$$;

-- 5. RLS na nova tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Dropar policies antigas que podem conflitar (ignora se não existir)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
END $$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 6. Remover policies overly permissive (se existirem)
DROP POLICY IF EXISTS "Service role can manage phone mappings" ON public.ghl_contact_phone_mapping;
DROP POLICY IF EXISTS "Service role can manage processed messages" ON public.ghl_processed_messages;
DROP POLICY IF EXISTS "Service role can manage message_map" ON public.message_map;
DROP POLICY IF EXISTS "Service role can insert webhook_metrics" ON public.webhook_metrics;
DROP POLICY IF EXISTS "Service role can manage alerts" ON public.server_health_alerts;
DROP POLICY IF EXISTS "Anyone can create registration request" ON public.registration_requests;
DROP POLICY IF EXISTS "Anyone can update registration requests" ON public.registration_requests;
DROP POLICY IF EXISTS "Anyone can view user_settings for embed access" ON public.user_settings;

-- 7. Inserir admin na user_roles (SUBSTITUA pelo seu user_id real)
-- INSERT INTO public.user_roles (user_id, role) VALUES ('SEU_USER_ID_AQUI', 'admin');

-- ============================================================
-- PRONTO! Agora descomente a linha acima e insira seu user_id
-- para se definir como admin no novo sistema de roles.
-- ============================================================
