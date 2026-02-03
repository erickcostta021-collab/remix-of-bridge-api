const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.7.0 - Phone Only Mode
console.log('🚀 BRIDGE LOADER: v6.7.0 Iniciado (Foco em Telefone)');

try {
    (function() {
        const VERSION = "6.7.0";
        const LOG_PREFIX = "[Bridge]";
        const CONFIG = {
            api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
            save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
            theme: { primary: '#22c55e', border: '#d1d5db', text: '#374151' }
        };

        let state = {
            instances: [],
            currentLocationId: null,
            lastPhoneFound: null,
            lastKnownActiveId: null,
            isSyncing: false
        };

        const log = {
            info: (msg, data) => console.log(\`\${LOG_PREFIX} ℹ️ \${msg}\`, data || ''),
            success: (msg, data) => console.log(\`\${LOG_PREFIX} ✅ \${msg}\`, data || ''),
            api: (msg, data) => console.log(\`\${LOG_PREFIX} 📡 \${msg}\`, data || ''),
            error: (msg, data) => console.error(\`\${LOG_PREFIX} ❌ \${msg}\`, data || '')
        };

        // 🎯 Extração calibrada para o seu <input class="hr-input-phone">
        function extractPhoneFromGHL() {
            const input = document.querySelector('input.hr-input-phone');
            let val = input ? input.value : "";
            
            if (!val) {
                const fallback = document.querySelector('[data-testid="contact-phone"]') || document.querySelector('a[href^="tel:"]');
                val = fallback ? (fallback.textContent || fallback.getAttribute('href')) : "";
            }

            const clean = val.replace(/\\D/g, '');
            if (clean.length === 11 && !clean.startsWith('55')) return '55' + clean;
            return clean.length >= 10 ? clean : null;
        }

        async function loadInstances(phone) {
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            if (!locId || !phone) return;

            state.currentLocationId = locId;
            log.api(\`Buscando instâncias para o telefone: \${phone}\`);

            try {
                // 🚀 ENVIANDO APENAS PHONE E LOCATION
                const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locId}&phone=\${phone}\`);
                const data = await res.json();

                if (data.instances) {
                    state.instances = data.instances;
                    const activeId = data.activeInstanceId || (data.instances[0]?.id);
                    state.lastKnownActiveId = activeId;
                    
                    const select = document.getElementById('bridge-instance-selector');
                    if (select) {
                        select.innerHTML = data.instances.map(i => 
                            \`<option value="\${i.id}" \${i.id === activeId ? 'selected' : ''}>\${i.name}</option>\`
                        ).join('');
                    }
                    log.success(\`Dados carregados para \${phone}\`);
                }
            } catch (e) { log.error('Erro no fetch', e); }
        }

        async function savePreference(instanceId) {
            const phone = extractPhoneFromGHL();
            const locId = state.currentLocationId;
            
            if (!phone) return alert("Não consegui ler o telefone para salvar.");

            log.info(\`💾 Salvando preferência para o telefone: \${phone}\`);

            try {
                // 🚀 REMOVIDO CONTACT_ID DO PAYLOAD
                const res = await fetch(CONFIG.save_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        instanceId: instanceId, 
                        locationId: locId, 
                        phone: phone 
                    })
                });

                if (res.ok) {
                    state.lastKnownActiveId = instanceId;
                    const inst = state.instances.find(i => i.id === instanceId);
                    showNotification(inst ? inst.name : "Atualizada");
                    log.success('Salvo com sucesso no Banco de Dados!');
                }
            } catch (e) { log.error('Erro ao salvar', e); }
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            const target = document.querySelector('.msg-composer-actions') || document.querySelector('#message-input-container');
            if (!target) return;

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 10px; padding: 2px 12px; height: 32px; background: #fff; border: 1px solid #d1d5db; border-radius: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);';
            container.innerHTML = \`<div style="width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:8px;"></div>
                                   <select id="bridge-instance-selector" style="border:none; background:transparent; font-size:12px; font-weight:700; outline:none; color:#374151; cursor:pointer;"></select>\`;
            
            target.appendChild(container);
            container.querySelector('select').addEventListener('change', (e) => savePreference(e.target.value));
            
            const initialPhone = extractPhoneFromGHL();
            if (initialPhone) loadInstances(initialPhone);
        }

        function showNotification(name) {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:10000; background:#1f2937; color:white; padding:12px 20px; border-radius:8px; border-left:4px solid #22c55e; font-size:13px; font-weight:600;';
            toast.innerHTML = \`✅ Instância <b>\${name}</b> vinculada ao telefone!\`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }

        // Loop de monitoramento ultra-rápido para troca de lead
        setInterval(() => {
            if (window.location.pathname.includes('/conversations')) {
                inject();
                const currentPhone = extractPhoneFromGHL();
                if (currentPhone && currentPhone !== state.lastPhoneFound) {
                    state.lastPhoneFound = currentPhone;
                    log.info(\`Detectado novo lead: \${currentPhone}\`);
                    loadInstances(currentPhone);
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
