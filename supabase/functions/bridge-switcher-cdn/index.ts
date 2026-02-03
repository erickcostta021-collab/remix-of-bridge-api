const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.8.4 - Clean View + Phone in Options Only
console.log('🚀 BRIDGE LOADER: v6.8.4 Iniciado');

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
            
            select.innerHTML = state.instances.map(i => 
                \`<option value="\${i.id}" \${i.id === activeId ? 'selected' : ''}>
                    \${i.name} \${i.phone ? ' - ' + i.phone : ''}
                </option>\`
            ).join('');
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            const actionBar = document.querySelector('.msg-composer-actions') || document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
            if (!actionBar) return;

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 10px; padding: 0 8px; height: 32px; background: #fff; border: 1px solid #d1d5db; border-radius: 6px; max-width: 180px;';
            
            container.innerHTML = \`
                <div style="width:7px; height:7px; background:#22c55e; border-radius:50%; margin-right:6px; flex-shrink:0;"></div>
                <select id="bridge-instance-selector" style="border:none; background:transparent; font-size:12px; font-weight:700; outline:none !important; box-shadow:none !important; color:#374151; cursor:pointer; width:100%; overflow:hidden; text-overflow:ellipsis;">
                    <option>...</option>
                </select>\`;
            
            actionBar.appendChild(container);

            container.querySelector('select').addEventListener('change', async (e) => {
                const phone = extractPhone();
                const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
                const selectedText = e.target.options[e.target.selectedIndex].text;

                try {
                    await fetch(CONFIG.save_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instanceId: e.target.value, locationId: locId, phone: phone })
                    });
                    showNotification(\`Ativado: \${selectedText.split('-')[0].trim()} ✅\`);
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
