const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_SWITCHER_SCRIPT = `(function() {
    console.log("🚀 BRIDGE API: Switcher v4.6.0 - Clean UI Edition");

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

    // 1. Injeção de CSS para matar a linha azul e formatar o dropdown
    const style = document.createElement('style');
    style.innerHTML = \`
        #bridge-instance-selector:focus, 
        #bridge-instance-selector:focus-visible,
        #bridge-api-container:focus-within { 
            outline: none !important; 
            box-shadow: none !important; 
            border: 1px solid \${CONFIG.theme.border} !important;
        }
        #bridge-instance-selector {
            max-width: 150px;
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
            border: none;
            background: transparent;
            font-size: 12px;
            font-weight: 700;
            color: \${CONFIG.theme.text};
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
        }
    \`;
    document.head.appendChild(style);

    function getGHLContactId() {
        const url = new URL(window.location.href);
        const fromQuery = url.searchParams.get('contactId') || url.searchParams.get('contact_id');
        if (fromQuery && fromQuery.length >= 10) return fromQuery;

        const path = url.pathname;
        const match = path.match(/(?:contacts\\/detail\\/|conversations\\/)([a-zA-Z0-9_-]{10,})/);
        return match ? match[1] : null;
    }

    async function syncBridgeContext(select) {
        const contactId = getGHLContactId();
        const locationId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
        if (!contactId || !locationId) return;

        try {
            const res = await fetch(\`\${CONFIG.save_url}?contactId=\${contactId}&locationId=\${locationId}&t=\${Date.now()}\`);
            const data = await res.json();
            
            if (data.activeInstanceId && select.value !== data.activeInstanceId) {
                select.value = data.activeInstanceId;
                const target = instanceData.find(i => i.id === data.activeInstanceId);
                if (target && currentContactId === contactId) showAutoSwitchNotify(target.name);
            }
            currentContactId = contactId;
        } catch (e) {}
    }

    function showAutoSwitchNotify(instanceName) {
        if (document.getElementById('bridge-notify')) return;
        const toast = document.createElement('div');
        toast.id = 'bridge-notify';
        toast.style.cssText = \`position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: #1f2937; color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; border-left: 4px solid \${CONFIG.theme.primary}; transition: opacity 0.5s ease;\`;
        toast.innerHTML = \`✅ Instância <b>\${instanceName}</b> selecionada.\`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
    }

    function injectBridgeUI() {
        const actionBar = document.querySelector('.msg-composer-actions') || document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
        if (actionBar && !document.getElementById('bridge-api-container')) {
            const wrapper = document.createElement('div');
            wrapper.id = 'bridge-api-container';
            wrapper.style.cssText = \`display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #ffffff; border: 1px solid \${CONFIG.theme.border}; border-radius: 20px;\`;
            wrapper.innerHTML = \`
                <div style="display:flex; align-items:center; gap:6px;">
                    <div id="bridge-status-indicator" style="width: 8px; height: 8px; background: \${CONFIG.theme.primary}; border-radius: 50%;"></div>
                    <select id="bridge-instance-selector"></select>
                </div>\`;
            actionBar.appendChild(wrapper);
            const select = wrapper.querySelector('#bridge-instance-selector');
            select.addEventListener('change', (e) => saveBridgePreference(e.target.value));
            loadBridgeOptions(select);
            setInterval(() => syncBridgeContext(select), 5000);
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
                // O segredo: já cria a option com o telefone no label
                select.innerHTML = instanceData.map(i => {
                    const label = i.phone ? \`\${i.name} (\${i.phone})\` : i.name;
                    return \`<option value="\${i.id}">\${label}</option>\`;
                }).join('');
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
      // Reduce cache to propagate hotfixes faster in GHL embedded environments
      "Cache-Control": "public, max-age=60, must-revalidate",
    },
  });
});
