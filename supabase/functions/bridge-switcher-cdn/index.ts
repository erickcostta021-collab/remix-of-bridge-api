const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.6.1 - Calibrada para hr-input-phone
console.log('🚀 BRIDGE LOADER: Script v6.6.1 Iniciado');

try {
    (function() {
        const VERSION = "6.6.1";
        const LOG_PREFIX = "[Bridge]";
        const CONFIG = {
            api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
            save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
            theme: { primary: '#22c55e', border: '#d1d5db', text: '#374151' }
        };

        let state = { instances: [], lastPhoneFound: null };

        // 🎯 NOVA EXTRAÇÃO: Agora lê o VALUE do input que você enviou
        function extractPhoneFromGHL() {
            const inputEl = document.querySelector('input.hr-input-phone');
            let rawPhone = "";
            
            if (inputEl && inputEl.value) {
                rawPhone = inputEl.value;
            } else {
                // Fallback caso o input não esteja pronto
                const phoneEl = document.querySelector('[data-testid="contact-phone"]') || document.querySelector('a[href^="tel:"]');
                rawPhone = phoneEl ? (phoneEl.textContent || phoneEl.getAttribute('href')) : "";
            }

            const clean = rawPhone.replace(/\\D/g, '');
            if (clean.length === 11 && !clean.startsWith('55')) return '55' + clean;
            return clean.length >= 10 ? clean : null;
        }

        async function loadInstances() {
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            const phone = extractPhoneFromGHL();
            if (!locId || !phone) return;

            try {
                const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locId}&phone=\${phone}\`);
                const data = await res.json();
                if (data.instances) {
                    state.instances = data.instances;
                    renderDropdown(data.activeInstanceId || data.instances[0]?.id);
                }
            } catch (e) { console.error(LOG_PREFIX, 'Erro ao carregar', e); }
        }

        async function savePreference(instanceId) {
            const phone = extractPhoneFromGHL();
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            if (!phone || !locId) return alert("Erro: Telefone não identificado no campo.");

            try {
                const res = await fetch(CONFIG.save_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instanceId, locationId: locId, phone })
                });
                if (res.ok) {
                    const inst = state.instances.find(i => i.id === instanceId);
                    showNotification(inst ? inst.name : "Selecionada");
                }
            } catch (e) { console.error(LOG_PREFIX, 'Erro ao salvar', e); }
        }

        function renderDropdown(activeId) {
            const select = document.getElementById('bridge-instance-selector');
            if (!select) return;
            select.innerHTML = state.instances.map(i => 
                \`<option value="\${i.id}" \${i.id === activeId ? 'selected' : ''}>\${i.name}</option>\`
            ).join('');
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            // Busca o container de ações (mesmo da 6.6.0)
            const actionBar = document.querySelector('.msg-composer-actions') || 
                               document.querySelector('#message-input-container') ||
                               document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
            if (!actionBar) return;

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #fff; border: 1px solid #d1d5db; border-radius: 20px;';
            container.innerHTML = \`<div style="width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:6px;"></div>
                                   <select id="bridge-instance-selector" style="border:none; background:transparent; font-size:11px; font-weight:700; outline:none; color:#333;"></select>\`;
            
            actionBar.appendChild(container);
            container.querySelector('select').addEventListener('change', (e) => savePreference(e.target.value));
            loadInstances();
        }

        function showNotification(name) {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:10000; background:#1f2937; color:white; padding:12px 20px; border-radius:8px; border-left:4px solid #22c55e; font-size:13px; box-shadow:0 4px 12px rgba(0,0,0,0.1);';
            toast.innerHTML = \`✅ Instância <b>\${name}</b> salva!\`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }

        setInterval(() => {
            if (window.location.pathname.includes('/conversations')) {
                inject();
                const phone = extractPhoneFromGHL();
                if (phone && phone !== state.lastPhoneFound) {
                    state.lastPhoneFound = phone;
                    console.log(LOG_PREFIX + " Novo lead detectado: " + phone);
                    loadInstances();
                }
            }
        }, 1500);
    })();
} catch (e) { console.error('Erro Crítico Bridge:', e); }
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
