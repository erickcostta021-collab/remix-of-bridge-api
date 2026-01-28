const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_SWITCHER_SCRIPT = `(function() {
    console.log("🚀 BRIDGE API: Switcher v6.0.0 - SPA Navigation + Real-Time Polling");

    const CONFIG = {
        api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
        save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
        poll_interval: 5000, // Poll for preference changes every 5 seconds
        url_check_interval: 300, // Check URL changes every 300ms for SPA navigation
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
    let lastUrl = window.location.href;

    // Toast notification for auto-switch
    function showAutoSwitchNotify(instanceName) {
        const existing = document.getElementById('bridge-auto-switch-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'bridge-auto-switch-toast';
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

    // Extract locationId from URL
    function getLocationId() {
        const match = window.location.pathname.match(/location\\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }

    // Robust contactId extraction with regex patterns
    function getContactId() {
        const path = window.location.pathname;
        
        // Reserved words that should NEVER be considered as contact IDs
        const reservedWords = [
            'conversations', 'contacts', 'detail', 'location', 'v2', 
            'settings', 'manual-actions', 'messages', 'opportunities',
            'payments', 'calendar', 'automation', 'sites', 'memberships',
            'reputation', 'reporting', 'marketing', 'phone', 'email'
        ];
        
        // Helper to validate ID format
        function isValidContactId(str) {
            if (!str) return false;
            if (str.length < 15) return false; // GHL IDs are typically 20+ chars
            if (!/^[a-zA-Z0-9]+$/.test(str)) return false;
            if (reservedWords.includes(str.toLowerCase())) return false;
            return true;
        }
        
        // Pattern 1: /contacts/detail/{contactId}
        const detailMatch = path.match(/\\/contacts\\/detail\\/([a-zA-Z0-9]+)/);
        if (detailMatch && isValidContactId(detailMatch[1])) {
            return detailMatch[1];
        }
        
        // Pattern 2: /conversations/{contactId}/... (ID right after conversations)
        const convMatch = path.match(/\\/conversations\\/([a-zA-Z0-9]+)/);
        if (convMatch && isValidContactId(convMatch[1])) {
            return convMatch[1];
        }
        
        // Pattern 3: Scan all segments for valid ID (20+ alphanumeric chars)
        const segments = path.split('/').filter(Boolean);
        for (let i = segments.length - 1; i >= 0; i--) {
            const seg = segments[i];
            if (seg.length >= 20 && isValidContactId(seg)) {
                return seg;
            }
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
                // Update tracking to prevent toast on manual change
                lastActiveInstanceId = e.target.value;
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
                
                // Initial sync for current contact
                const contactId = getContactId();
                if (contactId) {
                    currentContactId = contactId;
                    await syncBridgeContext(select, locationId, contactId, false);
                }
                
                // Start polling for real-time updates
                startPolling();
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
        
        try {
            const res = await fetch(\`\${CONFIG.save_url}?contactId=\${contactId}&locationId=\${locationId}&t=\${Date.now()}\`);
            const data = await res.json();
            
            if (data.activeInstanceId) {
                const targetInstance = instanceData.find(i => i.id === data.activeInstanceId);
                
                // Only update if instance exists and value changed
                if (targetInstance && select.value !== data.activeInstanceId) {
                    select.value = data.activeInstanceId;
                    updateDisplay(select, false);
                    
                    // Show toast only on real change (not initial load)
                    if (showToast && lastActiveInstanceId && lastActiveInstanceId !== data.activeInstanceId) {
                        showAutoSwitchNotify(targetInstance.name);
                    }
                }
                
                lastActiveInstanceId = data.activeInstanceId;
            }
        } catch (e) {
            console.error("Bridge sync error:", e);
        }
    }

    async function saveBridgePreference(instanceId) {
        const locationId = getLocationId();
        const contactId = getContactId();
        if (!contactId || !instanceId) return;
        
        await fetch(CONFIG.save_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceId, contactId, locationId, action: 'manual_switch' })
        });
    }

    // Polling: Check for preference updates every 5 seconds (only when tab is visible)
    function startPolling() {
        if (pollIntervalId) return; // Already polling
        
        pollIntervalId = setInterval(async () => {
            // Only poll when tab is visible
            if (document.hidden) return;
            
            const contactId = getContactId();
            const locationId = getLocationId();
            const select = document.getElementById('bridge-instance-selector');
            
            if (select && contactId && locationId && instanceData.length > 0) {
                // If contact changed, update tracking
                if (contactId !== currentContactId) {
                    currentContactId = contactId;
                    lastActiveInstanceId = null; // Reset to prevent false toast
                }
                
                await syncBridgeContext(select, locationId, contactId, true);
            }
        }, CONFIG.poll_interval);
    }

    // URL Change Detection: Monitor SPA navigation
    function startUrlWatcher() {
        setInterval(() => {
            const currentUrl = window.location.href;
            
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                handleUrlChange();
            }
        }, CONFIG.url_check_interval);
        
        // Also listen for popstate (back/forward navigation)
        window.addEventListener('popstate', handleUrlChange);
    }

    function handleUrlChange() {
        const newContactId = getContactId();
        const newLocationId = getLocationId();
        const select = document.getElementById('bridge-instance-selector');
        
        // Contact changed
        if (newContactId && newContactId !== currentContactId) {
            console.log("🔄 Bridge: Contact changed:", currentContactId, "→", newContactId);
            currentContactId = newContactId;
            lastActiveInstanceId = null; // Reset to avoid false toast
            
            if (select && instanceData.length > 0 && newLocationId) {
                syncBridgeContext(select, newLocationId, newContactId, false);
            }
        }
        
        // Location changed - reload everything
        if (newLocationId && newLocationId !== currentLocationId) {
            console.log("🔄 Bridge: Location changed, reloading...");
            currentLocationId = newLocationId;
            currentContactId = null;
            lastActiveInstanceId = null;
            
            if (select) {
                loadBridgeOptions(select);
            }
        }
    }

    // DOM Observer for UI injection
    const observer = new MutationObserver(() => {
        if (!document.getElementById('bridge-api-container')) injectBridgeUI();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initialize
    setTimeout(injectBridgeUI, 1000);
    startUrlWatcher();
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
