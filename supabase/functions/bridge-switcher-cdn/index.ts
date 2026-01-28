const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_SWITCHER_SCRIPT = `(function() {
    console.log("🚀 BRIDGE API: Switcher v6.0.0 - Auto-Sync from Webhook");

    const CONFIG = {
        api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
        save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
        theme: {
            primary: '#22c55e',
            border: '#d1d5db',
            text: '#374151'
        }
    };

    let instanceData = [];
    let currentContactId = null;
    let lastSyncedInstanceId = null;

    const style = document.createElement('style');
    style.innerHTML = \`
        #bridge-instance-selector:focus { outline: none !important; box-shadow: none !important; border: 1px solid \${CONFIG.theme.border} !important; }
        #bridge-instance-selector {
            border: none; background: transparent; font-size: 12px; font-weight: 700;
            color: \${CONFIG.theme.text}; cursor: pointer; appearance: none; -webkit-appearance: none;
            padding-right: 4px; width: 100%; max-width: 160px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;
        }
    \`;
    document.head.appendChild(style);

    function isValidContactId(value) {
        if (!value) return false;
        const v = String(value).trim();
        if (v.length < 10) return false;

        const blocked = new Set(['conversations', 'contacts', 'detail', 'inbox', 'chat', 'undefined', 'null']);
        if (blocked.has(v.toLowerCase())) return false;

        if (/^[a-zA-Z]+$/.test(v)) return false;
        return true;
    }

    function getGHLContactId() {
        const url = new URL(window.location.href);
        
        // Strategy 1: Check query params
        const fromQuery = url.searchParams.get('contactId') || url.searchParams.get('contact_id');
        if (isValidContactId(fromQuery)) return fromQuery;

        // Strategy 2: Check path - /contacts/detail/{id} or /conversations/{id}
        const match = window.location.pathname.match(/(?:contacts\\/detail\\/|conversations\\/)([a-zA-Z0-9_-]{10,})/);
        const fromPath = match ? match[1] : null;
        if (isValidContactId(fromPath)) return fromPath;

        // Strategy 3: Try to extract from GHL's internal state (React fiber)
        try {
            const conversationContainer = document.querySelector('[class*="conversation-detail"]') || 
                                         document.querySelector('[class*="ConversationDetail"]') ||
                                         document.querySelector('[data-contact-id]');
            if (conversationContainer) {
                const dataContactId = conversationContainer.getAttribute('data-contact-id');
                if (isValidContactId(dataContactId)) return dataContactId;
            }
        } catch (e) {}

        // Strategy 4: Look for contact ID in visible elements
        try {
            const contactIdElements = document.querySelectorAll('[class*="contact-id"], [data-testid*="contact"]');
            for (const el of contactIdElements) {
                const text = el.textContent?.trim() || el.getAttribute('data-contact-id') || '';
                if (isValidContactId(text)) return text;
            }
        } catch (e) {}

        return null;
    }

    // Ordena as instâncias colocando a ativa no topo
    function renderSortedOptions(select, activeId, showPhone) {
        if (!instanceData.length) return;

        const sorted = [...instanceData].sort((a, b) => {
            if (a.id === activeId) return -1;
            if (b.id === activeId) return 1;
            return a.name.localeCompare(b.name);
        });

        select.innerHTML = sorted.map(i => {
            const label = (showPhone && i.phone) ? \`\${i.name} (\${i.phone})\` : i.name;
            return \`<option value="\${i.id}" \${i.id === activeId ? 'selected' : ''}>\${label}</option>\`;
        }).join('');
    }

    async function syncBridgeContext(select) {
        const contactId = getGHLContactId();
        const locationId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
        
        if (!locationId) return;

        // Detect contact change - clear selection immediately to avoid showing wrong value
        if (currentContactId && currentContactId !== contactId) {
            console.log("🔄 Contato mudou, limpando seleção anterior...");
            select.value = '';
            lastSyncedInstanceId = null;
        }

        // If no valid contactId, just show first instance but don't save preference
        if (!contactId || !isValidContactId(contactId)) {
            console.log("⚠️ ContactId inválido ou não detectado, aguardando...");
            if (!select.value && instanceData.length > 0) {
                renderSortedOptions(select, instanceData[0].id, false);
            }
            return;
        }

        try {
            const res = await fetch(\`\${CONFIG.save_url}?contactId=\${contactId}&locationId=\${locationId}&t=\${Date.now()}\`);
            const data = await res.json();
            
            if (data.activeInstanceId) {
                // Only update UI if the backend has a different instance than what's currently shown
                // This allows webhook-inbound to control the dropdown by saving preferences
                if (data.activeInstanceId !== lastSyncedInstanceId) {
                    console.log("📍 Instância atualizada pelo backend:", data.activeInstanceId);
                    renderSortedOptions(select, data.activeInstanceId, false);
                    lastSyncedInstanceId = data.activeInstanceId;
                    
                    // Show notification only when contact changes
                    const target = instanceData.find(i => i.id === data.activeInstanceId);
                    if (target && currentContactId && currentContactId !== contactId) {
                        showAutoSwitchNotify(target.name);
                    }
                }
            } else {
                // No preference saved - use first instance
                console.log("📍 Sem preferência para este contato, usando primeira instância");
                if (!select.value && instanceData.length > 0) {
                    renderSortedOptions(select, instanceData[0].id, false);
                    lastSyncedInstanceId = instanceData[0].id;
                }
            }
            currentContactId = contactId;
        } catch (e) {
            console.error("Erro ao sincronizar contexto:", e);
        }
    }

    function showAutoSwitchNotify(instanceName) {
        if (document.getElementById('bridge-notify')) return;
        const toast = document.createElement('div');
        toast.id = 'bridge-notify';
        toast.style.cssText = \`position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: #1f2937; color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; border-left: 4px solid \${CONFIG.theme.primary};\`;
        toast.innerHTML = \`✅ Instância <b>\${instanceName}</b> selecionada automaticamente.\`;
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
                    <div style="width: 8px; height: 8px; background: \${CONFIG.theme.primary}; border-radius: 50%;"></div>
                    <select id="bridge-instance-selector"></select>
                </div>\`;
            actionBar.appendChild(wrapper);
            const select = wrapper.querySelector('#bridge-instance-selector');

            select.addEventListener('mousedown', () => renderSortedOptions(select, select.value, true));
            select.addEventListener('blur', () => renderSortedOptions(select, select.value, false));
            select.addEventListener('change', (e) => {
                saveBridgePreference(e.target.value);
                renderSortedOptions(select, e.target.value, false);
                lastSyncedInstanceId = e.target.value; // Track manual selection
            });

            loadBridgeOptions(select);
            
            // Sync every 3s - faster polling to catch webhook-inbound updates quicker
            setInterval(() => {
                syncBridgeContext(select);
            }, 3000);
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
                await syncBridgeContext(select);
                if (!select.value && instanceData.length) renderSortedOptions(select, instanceData[0].id, false);
            }
        } catch (e) {}
    }

    async function saveBridgePreference(instanceId) {
        const contactId = getGHLContactId();
        const locationId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
        if (!contactId || !instanceId || !isValidContactId(contactId)) {
            console.log("⚠️ Não é possível salvar preferência - contactId inválido:", contactId);
            return;
        }
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
