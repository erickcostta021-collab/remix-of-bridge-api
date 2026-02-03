const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.8.8 - Pure v6.6.0 UI + Fixed Label (No Phone in Header)
console.log('🚀 BRIDGE LOADER: v6.8.8 Iniciado');

try {
    (function() {
        const VERSION = "6.8.8";
        const LOG_PREFIX = "[Bridge]";
        
        const CONFIG = {
            api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
            save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
            theme: {
                primary: '#22c55e',
                border: '#d1d5db',
                text: '#374151'
            }
        };

        let state = { 
            instances: [], 
            lastPhoneFound: null, 
            currentLocationId: null
        };

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

        function injectStyles() {
            if (document.getElementById('bridge-styles')) return;
            const style = document.createElement('style');
            style.id = 'bridge-styles';
            style.textContent = \`
                #bridge-instance-selector:focus { outline: none !important; box-shadow: none !important; border: none !important; }
                #bridge-instance-selector {
                    border: none; background: transparent; font-size: 12px; font-weight: 700;
                    color: \${CONFIG.theme.text}; cursor: pointer; appearance: none; -webkit-appearance: none;
                    padding-right: 4px; width: 100%; max-width: 160px; text-overflow: ellipsis;
                    white-space: nowrap; overflow: hidden;
                }
            \`;
            document.head.appendChild(style);
        }

        function showNotification(instanceName) {
            const existing = document.getElementById('bridge-notify');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.id = 'bridge-notify';
            toast.style.cssText = \`position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: #1f2937; color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; border-left: 4px solid \${CONFIG.theme.primary}; transition: opacity 0.3s;\`;
            toast.innerHTML = \`✅ Instância <b>\${instanceName}</b> selecionada.\`;
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
        }

        async function loadInstances(phone) {
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            if (!locId || !phone) return;
            state.currentLocationId = locId;

            try {
                const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locId}&phone=\${phone}\`);
                const data = await res.json();
                if (data.instances) {
                    state.instances = data.instances;
                    renderOptions(data.activeInstanceId || data.instances[0]?.id);
                }
            } catch (e) { console.error(LOG_PREFIX, e); }
        }

        // A MÁGICA PARA ESCONDER O NÚMERO NO TOPO ESTÁ AQUI
        function renderOptions(activeId) {
            const select = document.getElementById('bridge-instance-selector');
            if (!select) return;
            
            select.innerHTML = ''; // Limpa
            
            state.instances.forEach(i => {
                const opt = document.createElement('option');
                opt.value = i.id;
                opt.selected = (i.id === activeId);
                
                // O rótulo (label) é o que aparece na LISTA (com número)
                // O texto (text) é o que aparece no TOPO (sem número)
                opt.textContent = i.name; 
                opt.label = i.phone ? \`\${i.name} (\${i.phone})\` : i.name;
                
                select.appendChild(opt);
            });
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            const actionBar = document.querySelector('.msg-composer-actions') || 
                              document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
            if (!actionBar) return;

            injectStyles();

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = \`display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #ffffff; border: 1px solid \${CONFIG.theme.border}; border-radius: 20px;\`;
            
            container.innerHTML = \`
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 8px; height: 8px; background: \${CONFIG.theme.primary}; border-radius: 50%;"></div>
                    <select id="bridge-instance-selector">
                        <option>...</option>
                    </select>
                </div>\`;
            
            actionBar.appendChild(container);

            container.querySelector('select').addEventListener('change', async (e) => {
                const phone = extractPhone();
                const instanceName = e.target.options[e.target.selectedIndex].text; // Pega o nome sem número

                try {
                    await fetch(CONFIG.save_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            instanceId: e.target.value, 
                            locationId: state.currentLocationId, 
                            phone: phone 
                        })
                    });
                    showNotification(instanceName);
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
