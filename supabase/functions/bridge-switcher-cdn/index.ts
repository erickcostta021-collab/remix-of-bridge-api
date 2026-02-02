const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.8.5 - Busca Agressiva
console.log('🚀 BRIDGE LOADER: v6.8.5 Iniciado');

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
            locationId: null,
            lastPhoneFound: null
        };

        const log = {
            info: (msg, data) => console.log(LOG_PREFIX + ' ℹ️ ' + msg, data || ''),
            success: (msg, data) => console.log(LOG_PREFIX + ' ✅ ' + msg, data || ''),
            warn: (msg, data) => console.warn(LOG_PREFIX + ' ⚠️ ' + msg, data || ''),
            error: (msg, data) => console.error(LOG_PREFIX + ' ❌ ' + msg, data || '')
        };

        function extractPhoneFromGHL() {
            // 1. Tenta pegar pelo atributo específico de telefone do GHL V2
            let phoneEl = document.querySelector('[data-testid="contact-phone"]') || 
                          document.querySelector('a[href^="tel:"]') ||
                          document.querySelector('#view-contact-phone');

            let rawPhone = "";

            if (phoneEl) {
                rawPhone = phoneEl.textContent || phoneEl.getAttribute('href') || "";
            } else {
                // 2. Busca desesperada: Procura qualquer texto que pareça um número longo na barra lateral
                const sidebar = document.querySelector('.contact-details') || document.body;
                const matches = sidebar.innerText.match(/\\+?\\d[\\d\\s\\-\\(\\)]{9,}\\d/g);
                if (matches) rawPhone = matches[0];
            }

            const cleanPhone = rawPhone.replace(/\\D/g, '');
            
            // Se o número for brasileiro e tiver sem o 55, nós adicionamos
            if (cleanPhone.length === 11 && !cleanPhone.startsWith('55')) {
                return '55' + cleanPhone;
            }

            return cleanPhone.length >= 10 ? cleanPhone : null;
        }

        async function savePreference(instanceId) {
            const phone = extractPhoneFromGHL();
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            
            log.info('Tentativa de salvamento:', { instanceId, phone, locId });

            if (!instanceId || !locId || !phone) {
                alert("⚠️ Não foi possível identificar o telefone do lead nesta tela.");
                return;
            }

            try {
                const response = await fetch(CONFIG.save_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instanceId, locationId: locId, phone })
                });
                
                if (response.ok) {
                    log.success('Instância alterada com sucesso!');
                    // Feedback visual para o usuário
                    const sel = document.getElementById('bridge-api-container');
                    sel.style.background = '#dcfce7'; 
                    setTimeout(() => sel.style.background = '#fff', 2000);
                } else {
                    log.error('Erro ao salvar: ' + response.status);
                }
            } catch (e) { log.error('Erro de conexão', e); }
        }

        function renderOptions(select) {
            if (state.instances.length === 0) return;
            const current = select.value;
            select.innerHTML = state.instances.map(i => 
                \`<option value="\${i.id}" \${i.id === current ? 'selected' : ''}>\${i.name}</option>\`
            ).join('');
        }

        async function loadInstances(locId) {
            try {
                const res = await fetch(CONFIG.api_url + '?locationId=' + locId);
                const data = await res.json();
                if (data.instances) {
                    state.instances = data.instances;
                    log.success(data.instances.length + ' instâncias carregadas');
                    const select = document.getElementById('bridge-instance-selector');
                    if (select) renderOptions(select);
                }
            } catch (e) { log.error('Erro ao carregar instâncias'); }
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            const actionBar = document.querySelector('.msg-composer-actions') || document.querySelector('#message-input-container');
            if (!actionBar) return;

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #fff; border: 1px solid #d1d5db; border-radius: 20px; transition: 0.3s;';
            container.innerHTML = \`<div style="width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:6px;"></div>
                                   <select id="bridge-instance-selector" style="border:none; background:transparent; font-size:12px; font-weight:700; outline:none;"></select>\`;
            
            actionBar.appendChild(container);
            const select = container.querySelector('select');
            select.addEventListener('change', (e) => savePreference(e.target.value));
            
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            if (locId) loadInstances(locId);
        }

        setInterval(() => {
            if (window.location.pathname.includes('/conversations')) {
                inject();
                // Sincronização automática ao mudar de lead
                const phone = extractPhoneFromGHL();
                if (phone && phone !== state.lastPhoneFound) {
                    state.lastPhoneFound = phone;
                    log.info('Lead focado: ' + phone);
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
