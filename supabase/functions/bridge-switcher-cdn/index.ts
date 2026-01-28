const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_SWITCHER_SCRIPT = `(function() {
    console.log("🚀 BRIDGE API: Switcher v5.1.0 - Real-Time Auto-Switch");

    const CONFIG = {
        api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
        save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
        poll_interval: 3000, // Poll for changes every 3 seconds
        theme: {
            primary: '#22c55e',
            error: '#ef4444',
            border: '#d1d5db',
            text: '#374151'
        }
    };

    let instanceData = [];
    let currentContactId = null;
    let currentLocationId = null;
    let lastActiveInstanceId = null;
    let pollIntervalId = null;

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

    function getLocationId() {
        return window.location.pathname.match(/location\\/([^\\/]+)/)?.[1] || null;
    }

    function getContactId() {
        const path = window.location.pathname;
        
        // Try to get contactId from contacts/detail/{contactId} pattern
        const detailMatch = path.match(/contacts\\/detail\\/([a-zA-Z0-9]+)/);
        if (detailMatch) {
            return detailMatch[1];
        }
        
        // Try to get conversationId from conversations/{conversationId} pattern
        const convMatch = path.match(/\\/conversations\\/([a-zA-Z0-9]{10,})/);
        if (convMatch && convMatch[1] !== 'conversations') {
            return convMatch[1];
        }
        
        // Fallback: last segment of URL that looks like an ID
        const segments = path.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        const reservedWords = ['conversations', 'contacts', 'detail', 'location', 'v2', 'settings'];
        
        if (lastSegment && 
            lastSegment.length >= 10 && 
            /^[a-zA-Z0-9]+$/.test(lastSegment) &&
            !reservedWords.includes(lastSegment.toLowerCase())) {
            return lastSegment;
        }
        
        return null;
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
                // Update lastActiveInstanceId to prevent toast on manual change
                lastActiveInstanceId = e.target.value;
            });
            
            loadBridgeOptions(select);
            
            // Start continuous polling for preference changes
            startPolling();
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
        const locationId = getLocationId();
        if (!locationId) return;
        
        currentLocationId = locationId;

        try {
            const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locationId}\`);
            const data = await res.json();
            
            if (data.instances && data.instances.length > 0) {
                instanceData = data.instances;
                select.innerHTML = instanceData.map(i => \`<option value="\${i.id}">\${i.name}</option>\`).join('');
                document.getElementById('bridge-status-indicator').style.background = CONFIG.theme.primary;
                
                // Initial sync
                const contactId = getContactId();
                if (contactId) {
                    await syncBridgeContext(select, locationId, contactId, false);
                }
            } else {
                select.innerHTML = \`<option value="">Offline</option>\`;
                document.getElementById('bridge-status-indicator').style.background = CONFIG.theme.error;
            }
        } catch (e) { 
            console.error("Bridge load error:", e);
            select.innerHTML = \`<option value="">Erro API</option>\`;
        }
    }

    async function syncBridgeContext(select, locationId, contactId, showToast = true) {
        if (!contactId || !locationId) return;
        
        currentContactId = contactId;
        
        try {
            const res = await fetch(\`\${CONFIG.save_url}?contactId=\${contactId}&locationId=\${locationId}&t=\${Date.now()}\`);
            const data = await res.json();
            
            if (data.activeInstanceId) {
                const targetInstance = instanceData.find(i => i.id === data.activeInstanceId);
                
                // Only update if the instance exists and value is different
                if (targetInstance && select.value !== data.activeInstanceId) {
                    console.log("🔄 Bridge: Switching to instance:", targetInstance.name);
                    select.value = data.activeInstanceId;
                    updateDisplay(select, false);
                    
                    // Show toast only if it's a real change (not initial load)
                    if (showToast && lastActiveInstanceId && lastActiveInstanceId !== data.activeInstanceId) {
                        showAutoSwitchNotify(targetInstance.name);
                    }
                    
                    lastActiveInstanceId = data.activeInstanceId;
                } else if (!lastActiveInstanceId && data.activeInstanceId) {
                    // First time setting - don't show toast
                    lastActiveInstanceId = data.activeInstanceId;
                }
            }
        } catch (e) {
            console.error("Bridge sync error:", e);
        }
    }

    async function saveBridgePreference(instanceId) {
        const locationId = getLocationId();
        const contactId = getContactId();
        if (!contactId || !instanceId) return;

        console.log("💾 Bridge: Saving preference:", { contactId, instanceId, locationId });
        
        await fetch(CONFIG.save_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceId, contactId, locationId, action: 'manual_switch' })
        });
    }

    // Start polling for preference changes (real-time updates when messages arrive)
    function startPolling() {
        if (pollIntervalId) return; // Already polling
        
        pollIntervalId = setInterval(async () => {
            const contactId = getContactId();
            const locationId = getLocationId();
            const select = document.getElementById('bridge-instance-selector');
            
            if (select && contactId && locationId && instanceData.length > 0) {
                await syncBridgeContext(select, locationId, contactId, true);
            }
        }, CONFIG.poll_interval);
        
        console.log("🔄 Bridge: Started polling for preference changes every", CONFIG.poll_interval, "ms");
    }

    // Check for URL changes (SPA navigation)
    function checkUrlChange() {
        const newContactId = getContactId();
        const newLocationId = getLocationId();
        
        // If contact changed, reset lastActiveInstanceId and re-sync
        if (newContactId && newContactId !== currentContactId) {
            console.log("🔄 Bridge: Contact changed:", { from: currentContactId, to: newContactId });
            lastActiveInstanceId = null; // Reset to prevent false toast
            const select = document.getElementById('bridge-instance-selector');
            if (select && instanceData.length > 0) {
                syncBridgeContext(select, newLocationId || currentLocationId, newContactId, false);
            }
        }
        
        // If location changed, reload everything
        if (newLocationId && newLocationId !== currentLocationId) {
            console.log("🔄 Bridge: Location changed, reloading instances...");
            lastActiveInstanceId = null;
            const select = document.getElementById('bridge-instance-selector');
            if (select) {
                loadBridgeOptions(select);
            }
        }
    }

    // Observe DOM changes (for initial injection)
    const observer = new MutationObserver(() => {
        if (!document.getElementById('bridge-api-container')) injectBridgeUI();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Poll for URL changes (handles SPA navigation)
    setInterval(checkUrlChange, 500);
    
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
