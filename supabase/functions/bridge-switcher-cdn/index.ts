const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_SWITCHER_SCRIPT = `(function() {
    console.log("🚀 BRIDGE API: Switcher v4.4.1 - Smart Display & Notify");

    const CONFIG = {
        api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
        save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
        theme: {
            primary: '#22c55e',
            error: '#ef4444',
            border: '#d1d5db',
            text: '#374151'
        }
    };

    let instanceData = [];

    // Função de notificação (Toast)
    function showAutoSwitchNotify(instanceName) {
        const toast = document.createElement('div');
        toast.style.cssText = \`
            position: fixed; bottom: 20px; right: 20px; z-index: 10000;
            background: #1f2937; color: white; padding: 12px 20px;
            border-radius: 8px; font-size: 13px; font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-left: 4px solid \${CONFIG.theme.primary};
            transition: opacity 0.5s ease; pointer-events: none;
        \`;
        toast.innerHTML = \`✅ Instância <b>\${instanceName}</b> selecionada automaticamente.\`;
        document.body.appendChild(toast);
        setTimeout(() => { 
            toast.style.opacity = '0'; 
            setTimeout(() => toast.remove(), 500); 
        }, 3500);
    }

    function injectBridgeUI() {
        const actionBar = document.querySelector('.msg-composer-actions') || 
                          document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');

        if (actionBar && !document.getElementById('bridge-api-container')) {
            const wrapper = document.createElement('div');
            wrapper.id = 'bridge-api-container';
            wrapper.style.cssText = \`
                display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px;
                height: 30px; width: auto; background: #ffffff; border: 1px solid \${CONFIG.theme.border};
                border-radius: 20px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                outline: none !important;
            \`;

            wrapper.innerHTML = \`
                <div style="display:flex; align-items:center; gap:6px;">
                    <div id="bridge-status-indicator" style="width: 8px; height: 8px; background: \${CONFIG.theme.primary}; border-radius: 50%;"></div>
                    <select id="bridge-instance-selector" style="
                        border: none; background: transparent; font-size: 12px; font-weight: 700;
                        color: \${CONFIG.theme.text}; outline: none !important; box-shadow: none !important;
                        cursor: pointer; appearance: none; -webkit-appearance: none; padding-right: 2px; width: auto;
                    "></select>
                    <svg width="8" height="5" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:0.5;">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            \`;

            actionBar.appendChild(wrapper);
            const select = wrapper.querySelector('#bridge-instance-selector');
            
            select.addEventListener('mousedown', () => updateDisplay(select, true));
            select.addEventListener('blur', () => updateDisplay(select, false));
            select.addEventListener('change', (e) => {
                saveBridgePreference(e.target.value);
                updateDisplay(select, false);
            });
            
            loadBridgeOptions(select);
        }
    }

    function updateDisplay(select, showFull) {
        Array.from(select.options).forEach(option => {
            const data = instanceData.find(i => i.id === option.value);
            if (data) {
                const phone = data.phone ? \` (\${data.phone})\` : "";
                option.text = showFull ? \`\${data.name}\${phone}\` : data.name;
            }
        });
    }

    async function loadBridgeOptions(select) {
        const locationId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
        if (!locationId) return;

        try {
            const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locationId}\`);
            const data = await res.json();
            
            if (data.instances && data.instances.length > 0) {
                instanceData = data.instances;
                select.innerHTML = instanceData.map(i => \`<option value="\${i.id}">\${i.name}</option>\`).join('');
                document.getElementById('bridge-status-indicator').style.background = CONFIG.theme.primary;
                
                syncBridgeContext(select, locationId);
            } else {
                select.innerHTML = \`<option value="">Offline</option>\`;
                document.getElementById('bridge-status-indicator').style.background = CONFIG.theme.error;
            }
        } catch (e) { 
            select.innerHTML = \`<option value="">Erro API</option>\`;
        }
    }

    async function syncBridgeContext(select, locationId) {
        const contactId = window.location.pathname.split('/').pop();
        if (!contactId || contactId.length < 5) return;
        try {
            // Adicionado timestamp para evitar cache e garantir que pegue a mudança do banco
            const res = await fetch(\`\${CONFIG.save_url}?contactId=\${contactId}&locationId=\${locationId}&t=\${Date.now()}\`);
            const data = await res.json();
            
            if (data.activeInstanceId && select.value !== data.activeInstanceId) {
                const targetInstance = instanceData.find(i => i.id === data.activeInstanceId);
                
                select.value = data.activeInstanceId;
                updateDisplay(select, false);

                // Dispara a notificação apenas se houver uma mudança automática
                if (targetInstance) {
                    showAutoSwitchNotify(targetInstance.name);
                }
            }
        } catch (e) {}
    }

    async function saveBridgePreference(instanceId) {
        const locationId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
        const contactId = window.location.pathname.split('/').pop();
        if (!contactId || !instanceId || contactId.length < 5) return;

        await fetch(CONFIG.save_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceId, contactId, locationId, action: 'manual_switch' })
        });
    }

    const observer = new MutationObserver(() => {
        if (!document.getElementById('bridge-api-container')) injectBridgeUI();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    setTimeout(injectBridgeUI, 1000);
})();`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(BRIDGE_SWITCHER_SCRIPT, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
