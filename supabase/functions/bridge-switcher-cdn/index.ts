const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.8.0 - API Fallback Mode
console.log('🚀 BRIDGE LOADER: v6.8.0 Iniciado');

try {
    (function() {
        const VERSION = "6.8.0";
        const LOG_PREFIX = "[Bridge]";
        const CONFIG = {
            api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
            save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher'
        };

        let state = { instances: [], lastPhoneFound: null, isFetching: false };

        // 🔍 Função Híbrida: Tenta DOM primeiro, depois API do GHL
        async function getPhone() {
            // 1. Tenta pegar do input que você mandou
            const input = document.querySelector('input.hr-input-phone');
            if (input && input.value) return cleanPhone(input.value);

            // 2. Se a aba tá fechada, pega o Contact ID da URL e pergunta ao GHL
            const contactId = window.location.pathname.match(/conversations\\/([^\\/\\?]+)/)?.[1];
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];

            if (contactId && contactId.length > 10 && !state.isFetching) {
                state.isFetching = true;
                try {
                    // Chamada para a API interna do HighLevel
                    const response = await fetch(\`/v1/contacts/\${contactId}\`, {
                        headers: { 'Accept': 'application/json' }
                    });
                    const data = await response.json();
                    state.isFetching = false;
                    return data.contact?.phone ? cleanPhone(data.contact.phone) : null;
                } catch (e) { 
                    state.isFetching = false;
                    return null; 
                }
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
                console.log(\`\${LOG_PREFIX} Lead: \${phone}\`);
                
                try {
                    const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locId}&phone=\${phone}\`);
                    const data = await res.json();
                    if (data.instances) {
                        state.instances = data.instances;
                        updateUI(data.activeInstanceId || data.instances[0]?.id);
                    }
                } catch (e) { console.error(LOG_PREFIX, e); }
            }
        }

        function updateUI(activeId) {
            const select = document.getElementById('bridge-instance-selector');
            if (select) {
                select.innerHTML = state.instances.map(i => 
                    \`<option value="\${i.id}" \${i.id === activeId ? 'selected' : ''}>\${i.name}</option>\`
                ).join('');
            }
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            const target = document.querySelector('.msg-composer-actions') || document.body;
            
            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'position:absolute; bottom:65px; right:20px; z-index:9999; display:flex; align-items:center; background:#fff; padding:4px 12px; border-radius:20px; border:2px solid #22c55e; box-shadow:0 2px 10px rgba(0,0,0,0.1);';
            container.innerHTML = \`<span style="font-size:9px; font-weight:800; color:#22c55e; margin-right:6px;">BRIDGE</span>
                                   <select id="bridge-instance-selector" style="border:none; background:transparent; font-size:11px; font-weight:700; outline:none; cursor:pointer;"></select>\`;
            
            target.style.position = 'relative';
            target.appendChild(container);
            
            container.querySelector('select').addEventListener('change', async (e) => {
                const phone = await getPhone();
                const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
                await fetch(CONFIG.save_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instanceId: e.target.value, locationId: locId, phone: phone })
                });
            });
            syncData();
        }

        setInterval(() => {
            if (window.location.pathname.includes('/conversations')) {
                inject();
                syncData();
            }
        }, 2000);
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
