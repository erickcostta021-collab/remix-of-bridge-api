# Prompt para recriar o projeto Bridge API no Lovable

Cole este prompt inteiro em um novo projeto Lovable para recriar o Bridge API do zero.

---

## PROMPT INÍCIO

Crie um aplicativo SaaS chamado **Bridge API** — uma plataforma que conecta WhatsApp ao GoHighLevel (GHL) usando a UAZAPI como motor de integração. O app é todo em **português brasileiro**. Use tema **dark** por padrão com verde (#22c55e) como cor primária e azul (#0088ff) como cor de marca secundária. Fundo escuro azul-navy.

### Design System (CSS Variables)
```
--background: 222 47% 11%
--foreground: 213 31% 91%
--card: 222 47% 13%
--primary: 142 71% 45% (verde)
--secondary: 217 33% 17%
--accent: 262 83% 58% (roxo)
--border: 217 33% 22%
--brand-blue: 211 100% 50%
--brand-green: 134 61% 41%
```

### Estrutura de Páginas e Rotas

1. **Landing Page** (`/`) — Página pública de marketing com:
   - Header fixo com logo "Bridge API", navegação (Início, Preços) e botões Entrar/Inicie Agora
   - Hero section com título "Conecte o WhatsApp ao GoHighLevel com estabilidade e melhor custo benefício"
   - Seção "Como Funciona" com diagrama arquitetural: WhatsApp ↔ UAZAPI ↔ GHL (com linhas animadas entre os ícones)
   - 3 steps: Configure UAZAPI → Adicione no Dashboard → Gerencie
   - Seção de Funcionalidades (8 cards): Reações/Edição mensagens, Áudios/Mídias, Múltiplos números, Gestão de grupos, Fotos atualizadas, Link White Label, Botões interativos, Ligações (em breve com overlay "Em Breve")
   - Seção de Preços com toggle BRL/USD (taxa R$5.50): Plano Flexível (slider 1-10 conexões, R$35/cada, trial grátis até 5), 50 conexões (R$798), 100 conexões (R$1298, badge "Mais Popular")
   - CTA final verde com "Pronto para ir para o próximo Level?"
   - Footer minimalista
   - Background com grid pattern sutil (linhas azuis 60x60px)

2. **Login** (`/login`) — Formulário de email/senha com link para registro e reset de senha

3. **Registro** (`/register`) — Fluxo de registro com verificação de código por email (usa edge function `send-registration-code` e `verify-registration-code`)

4. **Reset Password** (`/reset-password`) — Envio de email de reset via edge function `send-reset-password`

5. **Dashboard** (`/dashboard`, protegido) — Layout com sidebar colapsável + header:
   - Lista de subcontas GHL em grid (cards com nome e location_id)
   - Busca por subcontas
   - Botão "Sincronizar CRM" (puxa subcontas via API GHL usando agency token)
   - Ao clicar numa subconta: mostra instâncias WhatsApp vinculadas
   - Cada **Instance Card** mostra: nome, status (conectado/conectando/desconectado), foto de perfil, telefone, badge "API Oficial", usuário GHL atribuído
   - Actions por instância: Conectar (QR Code), Desconectar, Sincronizar status, Copiar token, Configurar webhook, Atribuir usuário GHL, Ativar/Desativar API Oficial, Desvincular, Excluir
   - Dialog de QR Code com auto-refresh a cada 30s
   - Botão "Copiar Link GHL" (gera embed link)
   - Alertas de: sem plano ativo, período de carência, conta compartilhada (modo espelho), UAZAPI não configurada

6. **Configurações** (`/settings`, protegido) — Tabs:
   - **OAuth GHL** (admin only): Client ID, Client Secret, Conversation Provider ID, URLs de webhook inbound/outbound
   - **Integrações**: Token de agência GHL, UAZAPI (URL base + Token admin + Webhook global), Track ID (identificador da instalação com botão copiar)
   - **Usuários** (admin only): Painel de usuários registrados
   - **CDN** (admin only): Gerenciamento de scripts CDN
   - Botões: Mostrar/Ocultar Tokens, Salvar Configurações
   - Dialog de alteração de senha

7. **Subaccount Settings** (`/subaccount/:id/settings`, protegido) — Config por subconta

8. **Embed Instances** (`/embed/:embedToken`) — Rota pública para clientes conectarem WhatsApp via iframe dentro do GHL

9. **OAuth Callback** (`/oauth/callback`) — Processa callback do OAuth GHL

10. **OAuth Success** (`/oauth/success/:locationId`) — Sucesso da instalação OAuth

11. **Admin Health** (`/admin/health`, protegido) — Dashboard de saúde do sistema (admin only)

12. **Checkout** (`/checkout`) — Página de checkout com planos via Stripe

### Sidebar do Dashboard
- Dashboard (ícone LayoutDashboard)
- "Comece por aqui" (dropdown expansível com steps numerados):
  1. Conectar subconta GHL (abre OAuth)
  2. Configurar Credenciais (dialog)
  3. Scripts (dialog)
- "Utilidades" (dropdown expansível):
  - Comandos: Gerenciar Grupos, Enviar Botões, Trocar Instância
  - Personalizar GHL: Customizar SMS, Tema WhatsApp
- Configurações
- Saúde do Sistema (admin only)
- Botão colapsar/expandir sidebar no desktop
- Mobile: overlay escuro + sidebar fixa

### Database Schema (Supabase/Lovable Cloud)

Crie as seguintes tabelas:

**profiles** — dados adicionais do usuário
- id (uuid PK), user_id (uuid unique, NOT NULL), email, full_name, phone, instance_limit (int default 5), is_paused (bool default false), paused_at (timestamp null), created_at, updated_at
- RLS: usuários veem/editam só seus dados

**user_settings** — configurações por usuário
- id (uuid PK), user_id (uuid unique), ghl_agency_token, ghl_client_id, ghl_client_secret, ghl_conversation_provider_id, uazapi_admin_token, uazapi_base_url, global_webhook_url, webhook_inbound_url, webhook_outbound_url, track_id (gerado automaticamente), external_supabase_url, external_supabase_key, external_supabase_pat, shared_from_user_id (uuid null), created_at, updated_at
- RLS: usuários veem/editam só seus dados

**user_roles** — sistema de roles
- id (uuid PK), user_id (uuid), role (enum: admin, moderator, user)
- Funções RPC: is_admin(), has_role()

**ghl_subaccounts** — subcontas do GoHighLevel
- id (uuid PK), user_id, location_id, account_name, company_id, ghl_user_id, ghl_subaccount_token, ghl_access_token, ghl_refresh_token, ghl_token_expires_at, ghl_token_scopes, oauth_installed_at, oauth_last_refresh, embed_token, skip_outbound (bool default false), created_at, updated_at
- RLS: usuários veem/editam só suas subcontas

**instances** — instâncias WhatsApp
- id (uuid PK), user_id, subaccount_id (FK ghl_subaccounts nullable), instance_name, uazapi_instance_token, instance_status (enum: connected, connecting, disconnected), webhook_url, ignore_groups (bool), ghl_user_id, phone, profile_pic_url, uazapi_base_url (null = usar global), is_official_api (bool default false), created_at, updated_at
- RLS: usuários veem/editam só suas instâncias

**message_map** — mapeamento de mensagens GHL↔WhatsApp
- ghl_message_id, uazapi_message_id, location_id, contact_id, from_me, message_text, message_type, original_timestamp, is_deleted, is_edited, reactions (jsonb)

**ghl_contact_phone_mapping** — cache de mapeamento contato→telefone
**ghl_processed_messages** — deduplicação de mensagens
**webhook_metrics** — métricas de webhooks
**server_health_alerts** — alertas de saúde dos servidores
**cdn_scripts** — scripts CDN gerenciados
**registration_requests** — requisições de registro com código
**contact_instance_preferences** — preferência de instância por contato

### Edge Functions necessárias:
- `webhook-inbound` — recebe webhooks da UAZAPI, processa mensagens, envia para GHL
- `webhook-outbound` — recebe webhooks do GHL, envia mensagens via UAZAPI
- `oauth-callback` — processa OAuth do GHL
- `refresh-token` / `refresh-all-tokens` — refresh de tokens OAuth
- `get-instances` — lista instâncias
- `configure-webhook` — configura webhook na UAZAPI
- `send-registration-code` / `verify-registration-code` / `mark-code-used` — fluxo de registro
- `send-reset-password` — reset de senha via Resend
- `check-email-exists` — verifica se email já existe
- `create-checkout` / `customer-portal` / `stripe-webhook` — integração Stripe
- `health-check` — verificação de saúde
- `group-commands` / `list-groups` — comandos de grupos WhatsApp
- `map-messages` — mapeamento de mensagens
- `ghost-audio` / `ghost-recorder` — funcionalidades de áudio
- `bridge-switcher` / `bridge-switcher-cdn` — script switcher (troca automática de instância)
- `bridge-toolkit-cdn` / `cdn-router` — CDN para scripts
- `obfuscate-script` — ofuscação de scripts
- `uazapi-proxy-embed` — proxy para embed
- `enforce-grace-period` — enforcement do período de carência
- `migrate-to-external` — migração para Supabase externo

### Funcionalidades-chave:
1. **Auth**: Email/senha com confirmação por email. Fluxo: solicitar código → verificar → criar conta
2. **Shared accounts**: Se dois usuários usam o mesmo agency token, o segundo vê em "modo espelho" (somente leitura)
3. **Instance limit**: Cada perfil tem limite de instâncias vinculadas (controlado por plano)
4. **Switcher automático**: Script CDN que troca automaticamente o número de envio no GHL baseado na última conversa
5. **Embed**: Link público para clientes conectarem WhatsApp por dentro do GHL (iframe)
6. **Stripe billing**: Planos flexíveis com trial de 5 dias, checkout via Stripe, período de carência
7. **Admin system**: Role-based (admin/moderator/user) com painel de usuários e saúde do sistema

### Tecnologias:
- React 18 + TypeScript + Vite
- Tailwind CSS com design tokens semânticos
- shadcn/ui (todos os componentes)
- TanStack React Query para data fetching
- React Router DOM para rotas
- Zustand para estado da sidebar
- Sonner para toasts
- Lucide React para ícones
- Lovable Cloud (Supabase) para backend

### Trigger importante:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```
A função `handle_new_user()` deve criar automaticamente um registro em `profiles` e `user_settings` (com track_id gerado) quando um novo usuário se registra.

### Secrets necessários:
- RESEND_API_KEY (para envio de emails)
- STRIPE_SECRET_KEY (para billing)
- FRONTEND_URL (URL do frontend publicado)

---

Comece pela landing page e sistema de autenticação, depois crie o dashboard com gerenciamento de subcontas e instâncias.

## PROMPT FIM
