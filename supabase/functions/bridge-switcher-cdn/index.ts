const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_SWITCHER_SCRIPT = `(function() {
    console.log("🚀 BRIDGE API: Switcher v5.2.0 - Phone-based lookup");

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
    let lastLeadPhone = null;

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

    // Try to extract phone number from the GHL interface
    function getLeadPhoneFromUI() {
        // Method 1: Look for phone in common contact/conversation elements
        const phoneSelectors = [
            // Very common community/custom CSS hooks
            '.contact-phone',
            '.contact-phone *',

            // Contact detail page phone field
            '.contact-phone-number',
            '[data-testid="contact-phone"]',
            '[data-testid="contact-phone"] *',

            // Tel links
            'a[href^="tel:"]',

            // Conversation header phone display
            '.conversation-header .phone-number',
            '.conversation-header [class*="phone"]',
            '.hl_conversations--header [class*="phone"]',
        ];
        
        for (const selector of phoneSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent || element.getAttribute('href') || '';
                const phone = extractPhoneNumber(text);
                if (phone) {
                    console.log("📱 Telefone detectado no GHL (selector):", phone);
                    return phone;
                }
            }
        }
        
        // Method 2: Header scan (some GHL themes put the phone only in the header/title)
        const headerEl = document.querySelector(
            '.conversation-header, .hl_conversations--header, header, [data-testid="conversation-header"]'
        );
        if (headerEl) {
            const headerText = headerEl.textContent || '';
            const phoneFromHeader = extractPhoneNumber(headerText);
            if (phoneFromHeader) {
                console.log("📱 Telefone detectado no GHL (header):", phoneFromHeader);
                return phoneFromHeader;
            }
        }

        // Method 3: Look for phone pattern in conversation sidebar/details
        const conversationArea = document.querySelector('.conversation-details, .contact-sidebar, .hl_conversations--details');
        if (conversationArea) {
            const text = conversationArea.textContent || '';
            const phone = extractPhoneNumber(text);
            if (phone) {
                console.log("📱 Telefone detectado no GHL (area):", phone);
                return phone;
            }
        }
        
        // Method 4: Check data attributes
        const contactElements = document.querySelectorAll('[data-phone], [data-contact-phone]');
        for (const el of contactElements) {
            const phone = el.getAttribute('data-phone') || el.getAttribute('data-contact-phone');
            if (phone) {
                console.log("📱 Telefone detectado no GHL (data-attr):", phone);
                return phone;
            }
        }
        
        console.log("📱 Telefone NÃO detectado no GHL UI");
        return null;
    }
    
    // Extract phone number from text - normalize to digits only
    function extractPhoneNumber(text) {
        if (!text) return null;
        
        // Remove common prefixes
        text = text.replace(/^tel:/i, '');
        
        // Look for phone patterns (Brazilian format: +55 XX XXXXX-XXXX or similar)
        const phoneRegex = /(?:\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{2,3}\\)?[-.\\s]?\\d{4,5}[-.\\s]?\\d{4}/g;
        const matches = text.match(phoneRegex);
        
        if (matches && matches.length > 0) {
            // Get only digits
            const digits = matches[0].replace(/\\D/g, '');
            if (digits.length >= 10) {
                return digits;
            }
        }
        return null;
    }

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
        const leadPhone = getLeadPhoneFromUI();
        
        if (!locationId) return;

        try {
            let url = \`\${CONFIG.api_url}?locationId=\${locationId}\`;
            
            // Prioritize phone over contactId
            if (leadPhone) {
                url += \`&phone=\${encodeURIComponent(leadPhone)}\`;
                console.log("📞 Buscando por telefone:", leadPhone);
            }
            
            // Also send contactId as fallback
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
                lastLeadPhone = leadPhone;
                
                console.log("📍 Loaded instances:", { 
                    count: instanceData.length, 
                    activeId, 
                    contactId,
                    leadPhone
                });
            }
        } catch (e) {
            console.error("Error loading instances:", e);
        }
    }

    async function syncContext(select) {
        const contactId = getGHLContactId();
        const locationId = getLocationId();
        const leadPhone = getLeadPhoneFromUI();
        
        // Log current state for debugging
        console.log("🔄 Sync check:", { contactId, locationId, lastContactId, leadPhone, currentValue: select.value });
        
        if (!locationId) {
            console.log("⚠️ No locationId found, skipping sync");
            return;
        }
        
        // CRITICAL: If contact or phone changed, clear dropdown and reload
        if (contactId !== lastContactId || leadPhone !== lastLeadPhone) {
            console.log("📍 Context changed, reloading...", { 
                fromContact: lastContactId, toContact: contactId,
                fromPhone: lastLeadPhone, toPhone: leadPhone
            });
            select.value = '';
            await loadInstances(select);
            return;
        }

        // If no valid contactId or phone, skip preference check
        if ((!contactId || isInvalidId(contactId)) && !leadPhone) {
            console.log("⚠️ No valid contactId or phone, skipping preference sync");
            return;
        }

        // Same contact - check for backend updates (e.g., message received on another instance)
        try {
            let syncUrl = \`\${CONFIG.save_url}?locationId=\${locationId}\`;
            if (leadPhone) {
                syncUrl += \`&phone=\${encodeURIComponent(leadPhone)}\`;
            }
            if (contactId && !isInvalidId(contactId)) {
                syncUrl += \`&contactId=\${contactId}\`;
            }
            
            const res = await fetch(syncUrl);
            const data = await res.json();
            
            console.log("📡 Backend preference:", { activeInstanceId: data.activeInstanceId, currentValue: select.value });
            
            if (data.activeInstanceId && select.value !== data.activeInstanceId) {
                const target = instanceData.find(i => i.id === data.activeInstanceId);
                if (target) {
                    console.log("🔀 Updating dropdown to match backend:", target.name);
                    select.value = data.activeInstanceId;
                    renderOptions(select, data.activeInstanceId);
                    showNotification(target.name);
                } else {
                    console.log("⚠️ Target instance not in dropdown:", data.activeInstanceId);
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
        const leadPhone = getLeadPhoneFromUI();
        
        if (!instanceId || !locationId) {
            console.log("Cannot save preference - missing data:", { instanceId, locationId });
            return;
        }
        
        // Need at least contactId or phone
        if ((!contactId || isInvalidId(contactId)) && !leadPhone) {
            console.log("Cannot save preference - no valid contactId or phone:", { contactId, leadPhone });
            return;
        }

        try {
            const payload = { instanceId, locationId };
            if (contactId && !isInvalidId(contactId)) {
                payload.contactId = contactId;
            }
            if (leadPhone) {
                payload.phone = leadPhone;
            }
            
            await fetch(CONFIG.save_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log("💾 Preference saved:", payload);
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
            
            // Sync every 3 seconds for faster updates
            setInterval(() => syncContext(select), 3000);
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
