const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.8.1 - Layout Original + API Fallback
console.log('🚀 BRIDGE LOADER: v6.8.1 Iniciado');

try {
    (function() {
        const VERSION = "6.8.1";
        const LOG_PREFIX = "[Bridge]";
        const CONFIG = {
            api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
            save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher'
        };

        let state = { instances: [], lastPhoneFound: null, isFetching: false };

        // 🔍 Busca telefone no Input OU via API interna do GHL
        async function getPhone() {
            const input = document.querySelector('input.hr-input-phone');
            if (input && input.value) return cleanPhone(input.value);

            const contactId = window.location.pathname.match(/conversations\\/([^\\/\\?]+)/)?.[1];
            if (contactId && contactId.length > 10 && !state.isFetching) {
                state.isFetching = true;
                try {
                    const response = await fetch(\`/v1/contacts/\${contactId}\`);
                    const data = await response.json();
                    state.isFetching = false;
                    return data.contact?.phone ? cleanPhone(data.contact.phone) : null;
                } catch (e) { state.isFetching = false; return null; }
            }
            return null;
        }

        function cleanPhone(raw) {
            const clean = raw.replace(/\\D/g, '');
            if (clean.length === 11 && !clean.startsWith('55')) return '55' + clean;
            return clean.length >= 10 ? clean : null;
        }

        async function syncData() {
            const phone = await getPhone();
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            if (phone && phone !== state.lastPhoneFound) {
                state.lastPhoneFound = phone;
                console.log(\`\${LOG_PREFIX} Lead Detectado: \${phone}\`);
                try {
                    const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locId}&phone=\${phone}\`);
                    const data = await res.json();
                    if (data.instances) {
                        state.instances = data.instances;
                        const select = document.getElementById('bridge-instance-selector');
                        if (select) {
                            const activeId = data.activeInstanceId || data.instances[0]?.id;
                            select.innerHTML = data.instances.map(i => 
                                \`<option value="\${i.id}" \${i.id === activeId ? 'selected' : ''}>\${i.name}</option>\`
                            ).join('');
                        }
                    }
                } catch (e) { console.error(LOG_PREFIX, e); }
            }
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;

            // Seletor original da barra de ações
            const actionBar = document.querySelector('.msg-composer-actions') || 
                               document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
            if (!actionBar) return;

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            // Voltei para o estilo inline discreto da v6.6.0
            container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #fff; border: 1px solid #d1d5db; border-radius: 20px;';
            
            container.innerHTML = \`
                <div style="width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:6px;"></div>
                <select id="bridge-instance-selector" style="border:none; background:transparent; font-size:11px; font-weight:700; outline:none; color:#333; box-shadow:none; -webkit-appearance:none; cursor:pointer;">
                    <option>...</option>
                </select>\`;
            
            actionBar.appendChild(container);

            container.querySelector('select').addEventListener('change', async (e) => {
                const phone = await getPhone();
                const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
                if (!phone) return;

                try {
                    await fetch(CONFIG.save_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instanceId: e.target.value, locationId: locId, phone: phone })
                    });
                    // Notificação simples sem bugar layout
                    console.log(LOG_PREFIX + " Salvo com sucesso!");
                } catch (err) { console.error("Erro ao salvar", err); }
            });
            syncData();
        }

        setInterval(() => {
            if (window.location.pathname.includes('/conversations')) {
                inject();
                syncData();
            }
        }, 1500);
    })();
} catch (e) { console.error('Erro Bridge:', e); }
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(BRIDGE_SWITCHER_SCRIPT, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=60, must-revalidate",
    },
  });
});
