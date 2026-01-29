const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_SWITCHER_SCRIPT = `(function() {
    console.log("🚀 BRIDGE API: Switcher v5.0.0 - Contact Isolation Reset");

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
    let lastContactId = null;

    const style = document.createElement('style');
    style.innerHTML = \`
        #bridge-instance-selector:focus { 
            outline: none !important; 
            box-shadow: none !important; 
            border: 1px solid \${CONFIG.theme.border} !important; 
        }
        #bridge-instance-selector {
            border: none; 
            background: transparent; 
            font-size: 12px; 
            font-weight: 700;
            color: \${CONFIG.theme.text}; 
            cursor: pointer; 
            appearance: none; 
            -webkit-appearance: none;
            padding-right: 4px; 
            width: 100%; 
            max-width: 160px; 
            text-overflow: ellipsis; 
            white-space: nowrap; 
            overflow: hidden;
        }
    \`;
    document.head.appendChild(style);

    function getGHLContactId() {
        const url = new URL(window.location.href);
        
        // Try query params first
        const fromQuery = url.searchParams.get('contactId') || url.searchParams.get('contact_id');
        if (fromQuery && fromQuery.length >= 10 && !isInvalidId(fromQuery)) return fromQuery;
        
        // Try to extract from URL path
        // Pattern 1: /contacts/detail/CONTACT_ID
        // Pattern 2: /conversations/CONTACT_ID (NOT just "conversations")
        const contactDetailMatch = window.location.pathname.match(/contacts\\/detail\\/([a-zA-Z0-9_-]{10,})/);
        if (contactDetailMatch) return contactDetailMatch[1];
        
        // For conversations URL: /conversations/CONTACT_ID where CONTACT_ID follows the path
        const conversationMatch = window.location.pathname.match(/conversations\\/([a-zA-Z0-9_-]{10,})/);
        if (conversationMatch && !isInvalidId(conversationMatch[1])) return conversationMatch[1];
        
        return null;
    }
    
    // Block known GHL placeholder/route values
    function isInvalidId(value) {
        if (!value) return true;
        const v = value.trim().toLowerCase();
        const blocked = ['conversations', 'contacts', 'detail', 'inbox', 'chat', 'settings', 'location'];
        if (blocked.includes(v)) return true;
        // Real IDs almost always have digits/underscores/hyphens
        if (/^[a-zA-Z]+$/.test(value)) return true;
        return false;
    }

    function getLocationId() {
        return window.location.pathname.match(/location\\/([^\\/]+)/)?.[1] || null;
    }

    // Render options with ONLY name (no phone)
    function renderOptions(select, activeId) {
        if (!instanceData.length) return;
        
        select.innerHTML = instanceData.map(i => 
            \`<option value="\${i.id}" \${i.id === activeId ? 'selected' : ''}>\${i.name}</option>\`
        ).join('');
    }

    // On mousedown: show phone numbers temporarily
    function showPhoneNumbers(select) {
        if (!instanceData.length) return;
        const currentValue = select.value;
        
        select.innerHTML = instanceData.map(i => {
            const label = i.phone ? \`\${i.name} (\${i.phone})\` : i.name;
            return \`<option value="\${i.id}" \${i.id === currentValue ? 'selected' : ''}>\${label}</option>\`;
        }).join('');
    }

    // On blur: hide phone numbers
    function hidePhoneNumbers(select) {
        renderOptions(select, select.value);
    }

    async function loadInstances(select) {
        const locationId = getLocationId();
        const contactId = getGHLContactId();
        
        if (!locationId) return;

        try {
            let url = \`\${CONFIG.api_url}?locationId=\${locationId}\`;
            if (contactId && contactId.length >= 10) {
                url += \`&contactId=\${contactId}\`;
            }
            
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.instances) {
                instanceData = data.instances;
                
                // Determine which instance to select
                let activeId = data.activeInstanceId;
                if (!activeId && instanceData.length > 0) {
                    activeId = instanceData[0].id;
                }
                
                renderOptions(select, activeId);
                lastContactId = contactId;
                
                console.log("📍 Loaded instances:", { 
                    count: instanceData.length, 
                    activeId, 
                    contactId 
                });
            }
        } catch (e) {
            console.error("Error loading instances:", e);
        }
    }

    async function syncContext(select) {
        const contactId = getGHLContactId();
        const locationId = getLocationId();
        
        if (!contactId || !locationId) return;
        
        // CRITICAL: If contact changed, clear dropdown and reload
        if (contactId !== lastContactId) {
            console.log("📍 Contact changed, reloading...", { from: lastContactId, to: contactId });
            select.value = '';
            await loadInstances(select);
            return;
        }

        // Same contact - just check for updates
        try {
            const res = await fetch(\`\${CONFIG.save_url}?contactId=\${contactId}&locationId=\${locationId}\`);
            const data = await res.json();
            
            if (data.activeInstanceId && select.value !== data.activeInstanceId) {
                const target = instanceData.find(i => i.id === data.activeInstanceId);
                if (target) {
                    select.value = data.activeInstanceId;
                    renderOptions(select, data.activeInstanceId);
                    showNotification(target.name);
                }
            }
        } catch (e) {
            console.error("Error syncing context:", e);
        }
    }

    function showNotification(instanceName) {
        if (document.getElementById('bridge-notify')) return;
        
        const toast = document.createElement('div');
        toast.id = 'bridge-notify';
        toast.style.cssText = \`
            position: fixed; 
            bottom: 20px; 
            right: 20px; 
            z-index: 10000; 
            background: #1f2937; 
            color: white; 
            padding: 12px 20px; 
            border-radius: 8px; 
            font-size: 13px; 
            font-weight: 600; 
            border-left: 4px solid \${CONFIG.theme.primary};
            transition: opacity 0.3s;
        \`;
        toast.innerHTML = \`✅ Instância <b>\${instanceName}</b> selecionada.\`;
        document.body.appendChild(toast);
        
        setTimeout(() => { 
            toast.style.opacity = '0'; 
            setTimeout(() => toast.remove(), 300); 
        }, 3000);
    }

    async function savePreference(instanceId) {
        const contactId = getGHLContactId();
        const locationId = getLocationId();
        
        if (!contactId || !instanceId || !locationId) {
            console.log("Cannot save preference - missing data:", { contactId, instanceId, locationId });
            return;
        }

        try {
            await fetch(CONFIG.save_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId, contactId, locationId })
            });
            console.log("💾 Preference saved:", { contactId, instanceId });
        } catch (e) {
            console.error("Error saving preference:", e);
        }
    }

    function injectUI() {
        const actionBar = document.querySelector('.msg-composer-actions') || 
                          document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
        
        if (actionBar && !document.getElementById('bridge-api-container')) {
            const wrapper = document.createElement('div');
            wrapper.id = 'bridge-api-container';
            wrapper.style.cssText = \`
                display: inline-flex; 
                align-items: center; 
                margin-left: 8px; 
                padding: 2px 10px; 
                height: 30px; 
                background: #ffffff; 
                border: 1px solid \${CONFIG.theme.border}; 
                border-radius: 20px;
            \`;
            wrapper.innerHTML = \`
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="width: 8px; height: 8px; background: \${CONFIG.theme.primary}; border-radius: 50%;"></div>
                    <select id="bridge-instance-selector"></select>
                </div>\`;
            
            actionBar.appendChild(wrapper);
            
            const select = wrapper.querySelector('#bridge-instance-selector');

            // Show phone on mousedown
            select.addEventListener('mousedown', () => showPhoneNumbers(select));
            
            // Hide phone on blur
            select.addEventListener('blur', () => hidePhoneNumbers(select));
            
            // Save on change
            select.addEventListener('change', (e) => {
                savePreference(e.target.value);
                hidePhoneNumbers(select);
            });

            // Initial load
            loadInstances(select);
            
            // Sync every 5 seconds
            setInterval(() => syncContext(select), 5000);
        }
    }

    // Watch for DOM changes to inject UI
    const observer = new MutationObserver(() => {
        if (!document.getElementById('bridge-api-container')) {
            injectUI();
        }
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
      "Cache-Control": "public, max-age=60, must-revalidate",
    },
  });
});
