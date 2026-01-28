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

    // 1. Captura dinâmica do ID do contato (GHL costuma expor via querystring)
    function getGHLContactId() {
        try {
            const url = new URL(window.location.href);
            // Em várias rotas do GHL, o contactId vem na query (?contactId=...)
            const fromQuery = url.searchParams.get('contactId') || url.searchParams.get('contact_id');
            if (fromQuery && fromQuery.length >= 10) return fromQuery;

            const path = url.pathname;
            const candidates = [
                /\/contacts\/detail\/([a-zA-Z0-9_-]{10,})/,          // Contacts
                /\/conversations\/messages\/([a-zA-Z0-9_-]{10,})/,  // Some UIs
                /\/conversations\/view\/([a-zA-Z0-9_-]{10,})/,      // Some UIs
                /\/conversations\/([a-zA-Z0-9_-]{10,})/             // Legacy conversations
            ];

            for (const re of candidates) {
                const m = path.match(re);
                if (m && m[1]) {
                    const id = m[1];
                    const reserved = ['messages', 'search', 'settings', 'list'];
                    if (!reserved.includes(id)) return id;
                }
            }
        } catch {
            // ignore
        }
        return null;
    }

    function getGHLLocationId() {
        try {
            const url = new URL(window.location.href);
            const fromPath = url.pathname.match(/location\/([^\/]+)/)?.[1];
            if (fromPath) return fromPath;
            return url.searchParams.get('locationId') || url.searchParams.get('location_id');
        } catch {
            return null;
        }
    }

    // 2. Sincronização com o Banco (Tabela contact_instance_preferences)
    async function syncBridgeContext(select) {
        const contactId = getGHLContactId();
        const locationId = getGHLLocationId();
        
        if (!contactId || !locationId) return;

        try {
            // Timestamp para evitar cache do navegador
            const res = await fetch(\`\${CONFIG.save_url}?contactId=\${contactId}&locationId=\${locationId}&t=\${Date.now()}\`);
            const data = await res.json();
            
            if (data.activeInstanceId) {
                if (select.value !== data.activeInstanceId) {
                    console.log(\`🔄 Instância atualizada para: \${data.activeInstanceId}\`);
                    select.value = data.activeInstanceId;
                    updateDisplay(select, false);
                    
                    const target = instanceData.find(i => i.id === data.activeInstanceId);
                    if (target && currentContactId === contactId) {
                        showAutoSwitchNotify(target.name);
                    }
                }
            } else if (!select.value && instanceData.length > 0) {
                // No preference found - select first instance as default but don't save
                select.value = instanceData[0].id;
                updateDisplay(select, false);
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
            
            // Show phone numbers when dropdown is opened
            select.addEventListener('mousedown', () => updateDisplay(select, true));
            select.addEventListener('focus', () => updateDisplay(select, true));
            // Hide phone numbers when dropdown is closed
            select.addEventListener('blur', () => updateDisplay(select, false));
            
            loadBridgeOptions(select);

            // Inicia o monitoramento de mudança de URL e o Polling de 5s
            if (syncInterval) clearInterval(syncInterval);
            syncInterval = setInterval(() => syncBridgeContext(select), 5000);
        }
    }

    async function loadBridgeOptions(select) {
        const locationId = getGHLLocationId();
        if (!locationId) return;
        try {
            const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locationId}\`);
            const data = await res.json();
            if (data.instances && data.instances.length > 0) {
                instanceData = data.instances;
                // Sort instances by name for consistent ordering
                instanceData.sort((a, b) => a.name.localeCompare(b.name));
                // Add placeholder option to prevent auto-selection
                select.innerHTML = '<option value="" disabled>Carregando...</option>' + instanceData.map(i => \`<option value="\${i.id}">\${i.name}</option>\`).join('');
                select.value = '';
                // Sync will set the correct value based on saved preference
                await syncBridgeContext(select);
                // Remove placeholder after sync
                const placeholder = select.querySelector('option[value=""]');
                if (placeholder) placeholder.remove();
            }
        } catch (e) {
            console.error("❌ Erro ao carregar instâncias:", e);
        }
    }

    async function saveBridgePreference(instanceId) {
        const contactId = getGHLContactId();
        const locationId = getGHLLocationId();
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
