const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.8.4 - Debug Ativado
console.log('🚀 BRIDGE LOADER: v6.8.4 Iniciado');

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
            isSyncing: false,
            lastPhoneFound: null,
            locationId: null
        };

        const log = {
            info: (msg, data) => console.log(LOG_PREFIX + ' ℹ️ ' + msg, data || ''),
            success: (msg, data) => console.log(LOG_PREFIX + ' ✅ ' + msg, data || ''),
            warn: (msg, data) => console.warn(LOG_PREFIX + ' ⚠️ ' + msg, data || ''),
            error: (msg, data) => console.error(LOG_PREFIX + ' ❌ ' + msg, data || '')
        };

        function extractPhoneFromGHL() {
            // Seletores otimizados para GHL V2
            const selectors = [
                '[data-testid="contact-phone"]', 
                '.contact-phone', 
                '.phone-number', 
                'a[href^="tel:"]',
                '.contact-details .phone'
            ];
            for (const s of selectors) {
                const el = document.querySelector(s);
                if (el) {
                    const text = el.textContent || el.getAttribute('href') || '';
                    const phone = text.replace(/\\D/g, ''); // CORRIGIDO: \\D simples
                    if (phone.length >= 10) return phone;
                }
            }
            return null;
        }

        async function savePreference(instanceId) {
            const phone = extractPhoneFromGHL();
            
            log.info('Tentando salvar preferência...', { 
                instance: instanceId, 
                phone: phone, 
                location: state.locationId 
            });

            if (!instanceId || !state.locationId || !phone) {
                log.warn('Abortado: Dados insuficientes para salvar.', {
                    hasInstance: !!instanceId,
                    hasLocation: !!state.locationId,
                    hasPhone: !!phone
                });
                return;
            }

            try {
                const response = await fetch(CONFIG.save_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instanceId, locationId: state.locationId, phone })
                });
                
                if (response.ok) {
                    state.lastKnownActiveId = instanceId;
                    log.success('Preferência salva no banco de dados!');
                } else {
                    log.error('Erro na resposta do servidor: ' + response.status);
                }
            } catch (e) { 
                log.error('Erro de conexão ao salvar preferência', e); 
            }
        }

        function renderOptions(select, showPhones = false) {
            if (state.instances.length === 0) {
                select.innerHTML = '<option>Carregando...</option>';
                return;
            }
            const currentValue = select.value || state.lastKnownActiveId;
            select.innerHTML = state.instances.map(i => {
                const label = (showPhones && i.phone) ? i.name + ' (' + i.phone + ')' : i.name;
                return '<option value="' + i.id + '"' + (i.id === currentValue ? ' selected' : '') + '>' + label + '</option>';
            }).join('');
        }

        async function loadInitialData() {
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            if (!locId) return;
            state.locationId = locId;

            try {
                const res = await fetch(CONFIG.api_url + '?locationId=' + locId);
                const data = await res.json();
                if (data.instances) {
                    state.instances = data.instances;
                    log.success(data.instances.length + ' instâncias carregadas');
                    const select = document.getElementById('bridge-instance-selector');
                    if (select) renderOptions(select, false);
                }
            } catch (e) { log.error('Erro ao carregar lista inicial'); }
        }

        async function syncActiveContact() {
            const phone = extractPhoneFromGHL();
            if (!state.locationId || !phone || state.isSyncing) return;
            if (phone === state.lastPhoneFound) return;

            try {
                state.lastPhoneFound = phone;
                log.info('Novo contato detectado: ' + phone);
                const res = await fetch(CONFIG.api_url + '?locationId=' + state.locationId + '&phone=' + phone);
                const data = await res.json();
                
                if (data.activeInstanceId) {
                    state.lastKnownActiveId = data.activeInstanceId;
                    const select = document.getElementById('bridge-instance-selector');
                    if (select) {
                        state.isSyncing = true;
                        select.value = data.activeInstanceId;
                        state.isSyncing = false;
                    }
                }
            } catch (e) {}
        }

        function injectDropdown() {
            if (document.getElementById('bridge-api-container')) return;

            const actionBar = document.querySelector('.msg-composer-actions') || 
                              document.querySelector('.flex.flex-row.gap-2.items-center.pl-2') ||
                              document.querySelector('.ghl-footer') ||
                              document.querySelector('#message-input-container');

            if (!actionBar) return; 

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #fff; border: 1px solid #d1d5db; border-radius: 20px; z-index: 10;';
            container.innerHTML = '<div style="width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:6px;"></div><select id="bridge-instance-selector" style="border:none; background:transparent; font-size:12px; font-weight:700; cursor:pointer; max-width:150px;"></select>';
            
            actionBar.appendChild(container);
            const select = container.querySelector('select');

            select.addEventListener('mousedown', () => renderOptions(select, true));
            select.addEventListener('blur', () => renderOptions(select, false));
            select.addEventListener('change', (e) => savePreference(e.target.value));

            renderOptions(select, false);
            if (state.instances.length === 0) loadInitialData();
        }

        setInterval(() => {
            if (window.location.pathname.includes('/conversations')) {
                injectDropdown();
                syncActiveContact();
            }
        }, CONFIG.sync_interval);

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
