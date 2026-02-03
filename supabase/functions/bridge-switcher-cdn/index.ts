const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.8.6 - Pure v6.6.0 UI + Hidden Phone State
console.log('🚀 BRIDGE LOADER: v6.8.6 Iniciado');

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
            const input = document.querySelector('input.hr-input-phone');
            if (input && input.value) return cleanPhone(input.value);
            const activeCard = document.querySelector('[data-is-active="true"][phone]');
            if (activeCard) return cleanPhone(activeCard.getAttribute('phone'));
            return null;
        }

        function showNotification(msg) {
            const t = document.createElement('div');
            t.style.cssText = 'position:fixed; top:80px; left:50%; transform:translateX(-50%); z-index:10001; background:#155EEF; color:white; padding:10px 20px; border-radius:30px; font-weight:bold; font-size:13px; box-shadow:0 4px 12px rgba(0,0,0,0.1); transition: opacity 0.3s;';
            t.innerText = msg;
            document.body.appendChild(t);
            setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2000);
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
            } catch (e) { console.error(LOG_PREFIX, e); }
        }

        function renderOptions(activeId) {
            const select = document.getElementById('bridge-instance-selector');
            if (!select) return;
            
            // Lógica para esconder o número no estado selecionado
            select.innerHTML = state.instances.map(i => {
                const isSelected = i.id === activeId;
                // No 'option', mostramos Nome + Telefone. 
                // O navegador cuida de mostrar apenas o texto da opção selecionada no topo.
                return \`<option value="\${i.id}" \${isSelected ? 'selected' : ''}>
                    \${i.name} \${i.phone ? ' (' + i.phone + ')' : ''}
                </option>\`;
            }).join('');
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            const actionBar = document.querySelector('.msg-composer-actions') || document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
            if (!actionBar) return;

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #fff; border: 1px solid #d1d5db; border-radius: 20px; max-width: 150px; overflow: hidden;';
            
            container.innerHTML = \`
                <div style="width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:6px; flex-shrink:0;"></div>
                <select id="bridge-instance-selector" style="border:none; background:transparent; font-size:11px; font-weight:700; outline:none !important; box-shadow:none !important; color:#333; cursor:pointer; -webkit-appearance:none; width: 100%; text-overflow: ellipsis;">
                    <option>...</option>
                </select>\`;
            
            actionBar.appendChild(container);

            container.querySelector('select').addEventListener('change', async (e) => {
                const phone = extractPhone();
                const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
                const selectedOption = e.target.options[e.target.selectedIndex];
                const instanceName = selectedOption.text.split('(')[0].trim();

                try {
                    await fetch(CONFIG.save_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instanceId: e.target.value, locationId: locId, phone: phone })
                    });
                    showNotification(\`Instância: \${instanceName} ✅\`);
                } catch (err) { console.error("Erro Save:", err); }
            });

            const p = extractPhone();
            if (p) loadInstances(p);
        }

        setInterval(() => {
            if (window.location.pathname.includes('/conversations')) {
                inject();
                const p = extractPhone();
                if (p && p !== state.lastPhoneFound) {
                    state.lastPhoneFound = p;
                    loadInstances(p);
                }
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
