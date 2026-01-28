const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_SWITCHER_SCRIPT = `(function() {
    console.log("🚀 BRIDGE API: Switcher v4.5.0 - SPA Optimized");

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
    let currentContactId = null;
    let syncInterval = null;

    // 1. Captura dinâmica do ID do contato (Suporta Conversations e Contacts)
    function getGHLContactId() {
        const path = window.location.pathname;
        const match = path.match(/(?:contacts\\/detail\\/|conversations\\/)([a-zA-Z0-9_-]{10,})/);
        const id = match ? match[1] : null;
        const reserved = ['messages', 'search', 'settings', 'list'];
        return reserved.includes(id) ? null : id;
    }

    // 2. Sincronização com o Banco (Tabela contact_instance_preferences)
    async function syncBridgeContext(select) {
        const contactId = getGHLContactId();
        const locationId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
        
        if (!contactId || !locationId) return;

        try {
            // Timestamp para evitar cache do navegador
            const res = await fetch(\`\${CONFIG.save_url}?contactId=\${contactId}&locationId=\${locationId}&t=\${Date.now()}\`);
            const data = await res.json();
            
            if (data.activeInstanceId && select.value !== data.activeInstanceId) {
                console.log(\`🔄 Instância atualizada para: \${data.activeInstanceId}\`);
                select.value = data.activeInstanceId;
                updateDisplay(select, false);
                
                const target = instanceData.find(i => i.id === data.activeInstanceId);
                if (target && currentContactId === contactId) {
                    showAutoSwitchNotify(target.name);
                }
            }
            currentContactId = contactId;
        } catch (e) {
            console.error("❌ Erro ao sincronizar instância:", e);
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

    function showAutoSwitchNotify(instanceName) {
        if (document.getElementById('bridge-notify')) return;
        const toast = document.createElement('div');
        toast.id = 'bridge-notify';
        toast.style.cssText = \`position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: #1f2937; color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-left: 4px solid \${CONFIG.theme.primary}; transition: opacity 0.5s ease;\`;
        toast.innerHTML = \`✅ Instância <b>\${instanceName}</b> selecionada.\`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3500);
    }

    function injectBridgeUI() {
        const actionBar = document.querySelector('.msg-composer-actions') || document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
        if (actionBar && !document.getElementById('bridge-api-container')) {
            const wrapper = document.createElement('div');
            wrapper.id = 'bridge-api-container';
            wrapper.style.cssText = \`display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #ffffff; border: 1px solid \${CONFIG.theme.border}; border-radius: 20px; cursor: pointer;\`;
            wrapper.innerHTML = \`<div style="display:flex; align-items:center; gap:6px;"><div id="bridge-status-indicator" style="width: 8px; height: 8px; background: \${CONFIG.theme.primary}; border-radius: 50%;"></div><select id="bridge-instance-selector" style="border: none; background: transparent; font-size: 12px; font-weight: 700; color: \${CONFIG.theme.text}; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none;"></select></div>\`;
            actionBar.appendChild(wrapper);
            const select = wrapper.querySelector('#bridge-instance-selector');
            
            select.addEventListener('change', (e) => saveBridgePreference(e.target.value));
            loadBridgeOptions(select);

            // Inicia o monitoramento de mudança de URL e o Polling de 5s
            if (syncInterval) clearInterval(syncInterval);
            syncInterval = setInterval(() => syncBridgeContext(select), 5000);
        }
    }

    async function loadBridgeOptions(select) {
        const locationId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
        if (!locationId) return;
        try {
            const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locationId}\`);
            const data = await res.json();
            if (data.instances) {
                instanceData = data.instances;
                select.innerHTML = instanceData.map(i => \`<option value="\${i.id}">\${i.name}</option>\`).join('');
                syncBridgeContext(select);
            }
        } catch (e) {}
    }

    async function saveBridgePreference(instanceId) {
        const contactId = getGHLContactId();
        const locationId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
        if (!contactId || !instanceId) return;
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
