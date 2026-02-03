const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.8.2 - Fixed Selector + Fast Phone Extraction
console.log('🚀 BRIDGE LOADER: v6.8.2 Iniciado');

try {
    (function() {
        const LOG_PREFIX = "[Bridge]";
        const CONFIG = {
            api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
            save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher'
        };

        let state = { instances: [], lastPhoneFound: null };

        function cleanPhone(raw) {
            if (!raw) return null;
            const clean = raw.replace(/\\D/g, '');
            if (clean.length === 11 && !clean.startsWith('55')) return '55' + clean;
            return clean.length >= 10 ? clean : null;
        }

        function extractPhone() {
            // 1. Tenta no input lateral (aba aberta)
            const input = document.querySelector('input.hr-input-phone');
            if (input && input.value) return cleanPhone(input.value);

            // 2. Tenta no elemento que você mandou (card ativo na lista)
            const activeCard = document.querySelector('[data-is-active="true"][phone]');
            if (activeCard) return cleanPhone(activeCard.getAttribute('phone'));

            return null;
        }

        async function loadInstances(phone) {
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            if (!locId || !phone) return;

            try {
                const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locId}&phone=\${phone}\`);
                const data = await res.json();
                if (data.instances) {
                    state.instances = data.instances;
                    renderOptions(data.activeInstanceId || data.instances[0]?.id);
                }
            } catch (e) { console.error(LOG_PREFIX, "Erro Load:", e); }
        }

        function renderOptions(activeId) {
            const select = document.getElementById('bridge-instance-selector');
            if (!select) return;
            
            if (state.instances.length === 0) {
                select.innerHTML = '<option>Nenhuma instância</option>';
                return;
            }

            select.innerHTML = state.instances.map(i => 
                \`<option value="\${i.id}" \${i.id === activeId ? 'selected' : ''}>\${i.name}</option>\`
            ).join('');
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;

            const actionBar = document.querySelector('.msg-composer-actions') || 
                               document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
            
            if (!actionBar) return;

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 12px; padding: 2px 8px; height: 32px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px;';
            
            container.innerHTML = \`
                <div style="width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:8px;"></div>
                <select id="bridge-instance-selector" style="border:none; background:transparent; font-size:12px; font-weight:600; outline:none !important; box-shadow:none !important; color:#374151; cursor:pointer; -webkit-appearance:none;">
                    <option>Carregando...</option>
                </select>\`;
            
            actionBar.appendChild(container);

            container.querySelector('select').addEventListener('change', async (e) => {
                const phone = extractPhone();
                const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
                if (!phone) return;

                try {
                    await fetch(CONFIG.save_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instanceId: e.target.value, locationId: locId, phone: phone })
                    });
                } catch (err) { console.error("Erro Save:", err); }
            });

            // Força busca imediata ao injetar
            const p = extractPhone();
            if (p) loadInstances(p);
        }

        // Loop principal
        setInterval(() => {
            if (window.location.pathname.includes('/conversations')) {
                inject();
                const currentPhone = extractPhone();
                if (currentPhone && currentPhone !== state.lastPhoneFound) {
                    state.lastPhoneFound = currentPhone;
                    console.log(LOG_PREFIX, "Telefone:", currentPhone);
                    loadInstances(currentPhone);
                }
            }
        }, 2000);
    })();
} catch (e) { console.error('Erro Fatal Bridge:', e); }
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
