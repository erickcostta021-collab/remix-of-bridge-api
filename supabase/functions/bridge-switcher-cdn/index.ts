const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_SWITCHER_SCRIPT = `(function() {
    console.log("🚀 BRIDGE API: Switcher v6.0.0 - Multi-source extraction");

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

    // =====================================================
    // PRIORITY 1: Extract contactId from URL (most reliable)
    // =====================================================
    function getGHLContactId() {
        const url = new URL(window.location.href);
        const pathname = window.location.pathname;
        
        // Method 1A: Query params (highest priority)
        const fromQuery = url.searchParams.get('contactId') || url.searchParams.get('contact_id');
        if (fromQuery && fromQuery.length >= 10 && !isInvalidId(fromQuery)) {
            console.log("🆔 ContactId via query param:", fromQuery);
            return fromQuery;
        }
        
        // Method 1B: URL path - /conversations/CONTACT_ID
        const conversationMatch = pathname.match(/\\/conversations\\/([a-zA-Z0-9]{10,})/);
        if (conversationMatch && !isInvalidId(conversationMatch[1])) {
            console.log("🆔 ContactId via /conversations/ path:", conversationMatch[1]);
            return conversationMatch[1];
        }
        
        // Method 1C: URL path - /contacts/detail/CONTACT_ID
        const contactDetailMatch = pathname.match(/\\/contacts\\/detail\\/([a-zA-Z0-9_-]{10,})/);
        if (contactDetailMatch) {
            console.log("🆔 ContactId via /contacts/detail/ path:", contactDetailMatch[1]);
            return contactDetailMatch[1];
        }
        
        // Method 1D: Any alphanumeric ID in path after common routes
        const genericMatch = pathname.match(/(?:conversation|contact|chat|inbox)\\/([a-zA-Z0-9]{15,})/i);
        if (genericMatch && !isInvalidId(genericMatch[1])) {
            console.log("🆔 ContactId via generic path match:", genericMatch[1]);
            return genericMatch[1];
        }
        
        console.log("🆔 ContactId: não encontrado na URL");
        return null;
    }
    
    // Block known GHL placeholder/route values
    function isInvalidId(value) {
        if (!value) return true;
        const v = value.trim().toLowerCase();
        const blocked = ['conversations', 'contacts', 'detail', 'inbox', 'chat', 'settings', 'location', 'undefined', 'null'];
        if (blocked.includes(v)) return true;
        // Real IDs almost always have digits - pure alphabetic is suspicious for short strings
        if (value.length < 15 && /^[a-zA-Z]+$/.test(value)) return true;
        return false;
    }

    // =====================================================
    // PRIORITY 2: Try GHL internal API/global objects
    // =====================================================
    function getPhoneFromGHLApi() {
        try {
            // Method 2A: v2_contact global object (common in GHL)
            if (window.v2_contact) {
                const phone = window.v2_contact.phone || window.v2_contact.phoneNumber || window.v2_contact.primaryPhone;
                if (phone) {
                    const digits = phone.replace(/\\D/g, '');
                    if (digits.length >= 10) {
                        console.log("📱 Telefone via window.v2_contact:", digits);
                        return digits;
                    }
                }
            }
            
            // Method 2B: __GHL_DATA__ or similar globals
            const ghlData = window.__GHL_DATA__ || window.__NEXT_DATA__?.props?.pageProps?.contact || window.contactData;
            if (ghlData) {
                const phone = ghlData.phone || ghlData.phoneNumber || ghlData.primaryPhone;
                if (phone) {
                    const digits = phone.replace(/\\D/g, '');
                    if (digits.length >= 10) {
                        console.log("📱 Telefone via GHL global data:", digits);
                        return digits;
                    }
                }
            }
            
            // Method 2C: React fiber state (advanced)
            const reactRoot = document.getElementById('__next') || document.getElementById('root') || document.getElementById('app');
            if (reactRoot && reactRoot._reactRootContainer) {
                const fiber = reactRoot._reactRootContainer._internalRoot?.current;
                if (fiber) {
                    // Walk fiber tree looking for contact state
                    const findPhone = (node, depth = 0) => {
                        if (depth > 10 || !node) return null;
                        const state = node.memoizedState || node.memoizedProps;
                        if (state?.phone || state?.contact?.phone) {
                            return (state.phone || state.contact.phone).replace(/\\D/g, '');
                        }
                        return findPhone(node.child, depth + 1) || findPhone(node.sibling, depth + 1);
                    };
                    const found = findPhone(fiber);
                    if (found && found.length >= 10) {
                        console.log("📱 Telefone via React fiber:", found);
                        return found;
                    }
                }
            }
        } catch (e) {
            console.log("📱 API interna não disponível:", e.message);
        }
        return null;
    }

    // =====================================================
    // PRIORITY 3: Extract phone from DOM attributes/elements
    // =====================================================
    function getLeadPhoneFromUI() {
        // Method 3A: Data attributes (most reliable DOM method)
        const dataAttrSelectors = [
            '[data-contact-phone]',
            '[data-phone]',
            '[data-lead-phone]',
            '[data-customer-phone]'
        ];
        
        for (const selector of dataAttrSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                const phone = el.getAttribute('data-contact-phone') || 
                              el.getAttribute('data-phone') || 
                              el.getAttribute('data-lead-phone') ||
                              el.getAttribute('data-customer-phone');
                if (phone) {
                    const digits = phone.replace(/\\D/g, '');
                    if (digits.length >= 10) {
                        console.log("📱 Telefone via data-attribute:", digits);
                        return digits;
                    }
                }
            }
        }
        
        // Method 3B: Tel links (very common)
        const telLinks = document.querySelectorAll('a[href^="tel:"]');
        for (const link of telLinks) {
            const href = link.getAttribute('href');
            const phone = extractPhoneNumber(href);
            if (phone) {
                console.log("📱 Telefone via tel: link:", phone);
                return phone;
            }
        }
        
        // Method 3C: Common CSS class selectors
        const phoneSelectors = [
            '.contact-phone',
            '.phone-number',
            '.contact-phone-number',
            '[data-testid="contact-phone"]',
            '.conversation-header .phone',
            '.hl_conversations--header [class*="phone"]',
            '.contact-info .phone',
            '.lead-phone',
            '.customer-phone'
        ];
        
        for (const selector of phoneSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent || element.innerText || '';
                const phone = extractPhoneNumber(text);
                if (phone) {
                    console.log("📱 Telefone via selector (" + selector + "):", phone);
                    return phone;
                }
            }
        }
        
        // Method 3D: Header scan
        const headerEl = document.querySelector(
            '.conversation-header, .hl_conversations--header, [data-testid="conversation-header"], .chat-header'
        );
        if (headerEl) {
            const headerText = headerEl.textContent || '';
            const phoneFromHeader = extractPhoneNumber(headerText);
            if (phoneFromHeader) {
                console.log("📱 Telefone via header text:", phoneFromHeader);
                return phoneFromHeader;
            }
        }

        // Method 3E: Sidebar/details area
        const sidebarAreas = document.querySelectorAll('.conversation-details, .contact-sidebar, .hl_conversations--details, .contact-details, .lead-details');
        for (const area of sidebarAreas) {
            const text = area.textContent || '';
            const phone = extractPhoneNumber(text);
            if (phone) {
                console.log("📱 Telefone via sidebar/details:", phone);
                return phone;
            }
        }
        
        return null;
    }
    
    // =====================================================
    // MASTER FUNCTION: Try all methods in priority order
    // =====================================================
    function getLeadPhone() {
        // Priority 2: GHL internal API (fast, reliable when available)
        let phone = getPhoneFromGHLApi();
        if (phone) return phone;
        
        // Priority 3: DOM scraping (fallback)
        phone = getLeadPhoneFromUI();
        if (phone) return phone;
        
        console.log("📱 Telefone NÃO detectado em nenhuma fonte");
        return null;
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
        const leadPhone = getLeadPhone();
        
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
        const leadPhone = getLeadPhone();
        
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
        const leadPhone = getLeadPhone();
        
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
