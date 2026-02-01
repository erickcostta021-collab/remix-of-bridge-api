const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: Telefone como ID + Visualização de Números v6.8.1
console.log('🚀 BRIDGE LOADER: Script carregado v6.8.1');

try {
    (function() {
        const LOG_PREFIX = "[Bridge]";
        const CONFIG = {
            api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
            save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
            sync_interval: 2000
        };

        let state = {
            instances: [],
            lastKnownActiveId: null,
            isSyncing: false
        };

        function extractPhoneFromGHL() {
            const phoneSelectors = ['[data-testid="contact-phone"]', '.contact-phone', '.phone-number', '.contact-details .phone', 'a[href^="tel:"]'];
            for (const selector of phoneSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                    const text = el.textContent || el.getAttribute('href') || '';
                    const phone = text.replace(/\\D/g, '');
                    if (phone.length >= 10) return phone;
                }
            }
            return null;
        }

        const log = {
            info: (msg, data) => console.log(\`\${LOG_PREFIX} ℹ️ \${msg}\`, data || ''),
            success: (msg, data) => console.log(\`\${LOG_PREFIX} ✅ \${msg}\`, data || ''),
            error: (msg, data) => console.error(\`\${LOG_PREFIX} ❌ \${msg}\`, data || '')
        };

        // =====================================================
        // VISUAL: MOSTRAR/ESCONDER TELEFONES NO DROPDOWN
        // =====================================================
        function renderOptions(select, showPhones = false) {
            const currentValue = select.value;
            select.innerHTML = state.instances.map(i => {
                const label = (showPhones && i.phone) ? \`\${i.name} (\${i.phone})\` : i.name;
                return \`<option value="\${i.id}" \${i.id === currentValue ? 'selected' : ''}>\${label}</option>\`;
            }).join('');
        }

        async function savePreference(instanceId) {
            const locationId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            const phone = extractPhoneFromGHL();
            if (!instanceId || !locationId || !phone) return;

            try {
                const payload = { instanceId, locationId, phone };
                log.info(\`📡 Salvando para o telefone: \${phone}\`);
                
                await fetch(CONFIG.save_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                state.lastKnownActiveId = instanceId;
                log.success('Salvo!');
            } catch (e) { log.error('Erro ao salvar'); }
        }

        async function fetchSync() {
            const locationId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            const phone = extractPhoneFromGHL();
            if (!locationId || !phone || state.isSyncing) return;

            try {
                const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locationId}&phone=\${phone}\`);
                const data = await res.json();
                
                if (data.instances) state.instances = data.instances;
                
                if (data.activeInstanceId && data.activeInstanceId !== state.lastKnownActiveId) {
                    state.lastKnownActiveId = data.activeInstanceId;
                    const select = document.getElementById('bridge-instance-selector');
                    if (select) {
                        state.isSyncing = true;
                        select.value = data.activeInstanceId;
                        renderOptions(select, false);
                        setTimeout(() => { state.isSyncing = false; }, 500);
                    }
                }
            } catch (e) {}
        }

        function injectDropdown() {
            if (document.getElementById('bridge-api-container')) return;
            const actionBar = document.querySelector('.msg-composer-actions') || document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
            if (!actionBar) return;

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #fff; border: 1px solid #d1d5db; border-radius: 20px;';
            container.innerHTML = \`<div style="width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:6px;"></div><select id="bridge-instance-selector" style="border:none; background:transparent; font-size:12px; font-weight:700; cursor:pointer; max-width:150px;"></select>\`;
            
            actionBar.appendChild(container);
            const select = container.querySelector('select');

            // EVENTOS PARA MOSTRAR TELEFONES
            select.addEventListener('mousedown', () => renderOptions(select, true));
            select.addEventListener('blur', () => renderOptions(select, false));
            select.addEventListener('change', (e) => {
                savePreference(e.target.value);
                renderOptions(select, false);
            });

            fetchSync();
        }

        setInterval(() => {
            if (window.location.pathname.includes('/conversations/')) {
                injectDropdown();
                fetchSync();
            }
        }, CONFIG.sync_interval);
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
