const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.14.1 - Outbound switch notification (fix conversationId)
console.log('🚀 BRIDGE LOADER: v6.14.1 Iniciado');

try {
    (function() {
        const LOG_PREFIX = "[Bridge]";

        // Resolve the correct functions origin from the script tag (works across preview/prod/CDN variations)
        function resolveFunctionsOrigin() {
            try {
                const src = (document.currentScript && document.currentScript.src) ||
                    Array.from(document.scripts).map(s => s.src).find(s => s && s.includes('/functions/v1/bridge-switcher-cdn')) ||
                    Array.from(document.scripts).map(s => s.src).find(s => s && s.includes('bridge-switcher-cdn'));
                if (src) return new URL(src).origin;
            } catch (e) {}
            // Fallback to the hardcoded project origin
            return 'https://jsupvprudyxyiyxwqxuq.supabase.co';
        }

        const FUNCTIONS_ORIGIN = resolveFunctionsOrigin();
        const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdXB2cHJ1ZHl4eWl5eHdxeHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzMwNDAsImV4cCI6MjA4NDUwOTA0MH0._Ge7hb5CHCE6mchtjGLbWXx5Q9i_D7P0dn7OlMYlvyM';

        const CONFIG = {
            api_url: FUNCTIONS_ORIGIN + '/functions/v1/get-instances',
            save_url: FUNCTIONS_ORIGIN + '/functions/v1/bridge-switcher',
            theme: { primary: '#22c55e', border: '#d1d5db', text: '#374151' }
        };

        const FUNCTION_HEADERS = {
            'Content-Type': 'application/json',
            apikey: ANON_KEY,
            Authorization: 'Bearer ' + ANON_KEY,
        };

        let state = { instances: [], lastPhoneFound: null, currentLocationId: null, currentInstanceName: null, currentConversationId: null };

        function extractConversationId() {
            // Prefer explicit params if present
            const urlParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.slice(1));
            const fromParams = urlParams.get('conversationId') || hashParams.get('conversationId');
            if (fromParams && fromParams.length >= 10) return fromParams;

            // Robust path parsing across GHL variants.
            // Common patterns:
            // - /conversations/detail/:id
            // - /location/:locationId/conversations/detail/:id
            // - /location/:locationId/conversations/:id
            const parts = window.location.pathname.split('/').filter(Boolean);
            const idxDetail = parts.indexOf('detail');
            if (idxDetail !== -1) {
                const candidate = parts[idxDetail + 1];
                if (candidate && candidate !== 'conversations' && candidate.length >= 10) return candidate;
            }

            // Fallback: look for a plausible conversation id after a 'conversations' segment.
            // We avoid returning placeholders like 'conversations' or 'detail'.
            const idxConv = parts.lastIndexOf('conversations');
            if (idxConv !== -1) {
                const candidate = parts[idxConv + 1];
                if (candidate && candidate !== 'detail' && candidate !== 'conversations' && candidate.length >= 10) return candidate;
            }

            return null;
        }

        function cleanPhone(raw) {
            if (!raw) return null;
            const clean = raw.replace(/\\D/g, '');
            if (clean.length === 11 && !clean.startsWith('55')) return '55' + clean;
            return clean.length >= 10 ? clean : null;
        }

        function extractPhone() {
            const input = document.querySelector('input.hr-input-phone');
            if (input && input.value) return cleanPhone(input.value);
            const activeCard = document.querySelector('[data-is-active="true"][phone]');
            if (activeCard) return cleanPhone(activeCard.getAttribute('phone'));
            return null;
        }

        function showNotification(instanceName) {
            const existing = document.getElementById('bridge-notify');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.id = 'bridge-notify';
            toast.style.cssText = \`position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: #1f2937; color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; border-left: 4px solid \${CONFIG.theme.primary}; transition: opacity 0.3s;\`;
            toast.innerHTML = \`✅ Instância <b>\${instanceName}</b> selecionada.\`;
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
        }

        function injectChatNotification(fromInstance, toInstance) {
            console.log(LOG_PREFIX, '🔄 Attempting to inject chat notification:', fromInstance, '→', toInstance);
            
            // First, find an existing outgoing message to clone its structure/classes
            const existingOutgoingMsg = document.querySelector('[class*="outgoing"]') || 
                                        document.querySelector('[class*="sent"]') ||
                                        document.querySelector('[class*="message-out"]') ||
                                        document.querySelector('.hl-message-outgoing') ||
                                        document.querySelector('[data-message-direction="outgoing"]');
            
            if (existingOutgoingMsg) {
                console.log(LOG_PREFIX, '📋 Found existing outgoing message, cloning structure:', existingOutgoingMsg.className);
            }
            
            // Try multiple selectors for GHL chat message list
            const selectors = [
                '.hl_conversations--messages-renderer',
                '.conversation-messages-wrapper',
                '.message-list',
                '.messages-wrapper',
                '[class*="message-list"]',
                '[class*="messages-container"]',
                '[class*="chat-messages"]',
                '.msg-list-container'
            ];
            
            let chatContainer = null;
            for (const selector of selectors) {
                chatContainer = document.querySelector(selector);
                if (chatContainer) {
                    console.log(LOG_PREFIX, '✅ Found chat container with selector:', selector);
                    // Log container's children structure for debugging
                    console.log(LOG_PREFIX, '📦 Container children count:', chatContainer.children.length);
                    if (chatContainer.lastElementChild) {
                        console.log(LOG_PREFIX, '📦 Last child classes:', chatContainer.lastElementChild.className);
                    }
                    break;
                }
            }
            
            if (!chatContainer) {
                console.log(LOG_PREFIX, '⚠️ Chat container not found, using overlay notification');
                
                const existingOverlay = document.getElementById('bridge-switch-overlay');
                if (existingOverlay) existingOverlay.remove();
                
                const overlay = document.createElement('div');
                overlay.id = 'bridge-switch-overlay';
                overlay.style.cssText = \`
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 10001;
                    padding: 10px 20px;
                    background: #1f2937;
                    color: white;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                \`;
                
                overlay.innerHTML = \`🔄 Instância alterada: <b>\${fromInstance}</b> → <b>\${toInstance}</b>\`;
                document.body.appendChild(overlay);
                
                setTimeout(() => {
                    overlay.style.opacity = '0';
                    overlay.style.transition = 'opacity 0.3s';
                    setTimeout(() => overlay.remove(), 300);
                }, 4000);
                
                return;
            }

            // Remove any existing bridge notifications
            document.querySelectorAll('.bridge-switch-notification').forEach(el => el.remove());

            // Create a message wrapper that mimics GHL's outgoing message structure
            const msgWrapper = document.createElement('div');
            msgWrapper.className = 'bridge-switch-notification hl-message hl-message-outgoing';
            msgWrapper.setAttribute('data-bridge-notification', 'true');
            msgWrapper.style.cssText = \`
                display: flex;
                flex-direction: row-reverse;
                align-items: flex-end;
                padding: 4px 16px;
                margin: 4px 0;
                width: 100%;
            \`;
            
            // Create the message bubble (outgoing style - right aligned, blue/green background)
            const bubble = document.createElement('div');
            bubble.className = 'hl-message-bubble hl-message-bubble-outgoing';
            bubble.style.cssText = \`
                background: #3b82f6;
                color: white;
                padding: 8px 12px;
                border-radius: 12px 12px 2px 12px;
                font-size: 13px;
                max-width: 70%;
                word-wrap: break-word;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            \`;
            bubble.innerHTML = \`🔄 Instância alterada: <b>\${fromInstance}</b> → <b>\${toInstance}</b>\`;
            
            msgWrapper.appendChild(bubble);
            
            // Insert at the end of the chat container
            chatContainer.appendChild(msgWrapper);
            
            // Scroll to the new message
            msgWrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
            
            console.log(LOG_PREFIX, '✅ Chat notification injected as outgoing message');
        }

        function renderOptions(showPhone = false) {
            const select = document.getElementById('bridge-instance-selector');
            if (!select) return;
            const currentVal = select.value;
            
            if (!state.instances || state.instances.length === 0) {
                select.innerHTML = '<option value="">Sem instâncias</option>';
                return;
            }

            select.innerHTML = state.instances.map(i => {
                const text = showPhone && i.phone ? (String(i.name) + ' (' + String(i.phone) + ')') : i.name;
                const selected = i.id === currentVal ? 'selected' : '';
                return '<option value="' + i.id + '" ' + selected + '>' + text + '</option>';
            }).join('');
        }

        async function loadInstances(phone) {
            const m = window.location.pathname.match(/location\/([^\/]+)/);
            const locId = (m && m[1]) ? m[1] : null;
            if (!locId || !phone) {
                console.log(LOG_PREFIX, '⚠️ Missing locId/phone for loadInstances:', { locId, hasPhone: !!phone, path: window.location.pathname });
                return;
            }
            state.currentLocationId = locId;
            try {
                const url = CONFIG.api_url + '?locationId=' + encodeURIComponent(locId) + '&phone=' + encodeURIComponent(phone);
                console.log(LOG_PREFIX, '📡 Fetching instances:', url);

                const res = await fetch(url, {
                    method: 'GET',
                    headers: {
                        apikey: ANON_KEY,
                        Authorization: 'Bearer ' + ANON_KEY,
                    },
                });

                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    console.log(LOG_PREFIX, '❌ get-instances failed:', res.status, text.slice(0, 300));
                    state.instances = [];
                    renderOptions(false);
                    return;
                }

                const data = await res.json().catch(() => null);
                if (!data || !Array.isArray(data.instances)) {
                    console.log(LOG_PREFIX, '❌ get-instances invalid JSON:', data);
                    state.instances = [];
                    renderOptions(false);
                    return;
                }

                state.instances = data.instances;
                const firstId = (data.instances[0] && data.instances[0].id) ? data.instances[0].id : null;
                const activeId = data.activeInstanceId || firstId;
                const activeInstance = state.instances.find(i => i.id === activeId);
                state.currentInstanceName = (activeInstance && activeInstance.name) ? activeInstance.name : null;
                const select = document.getElementById('bridge-instance-selector');
                if (select && activeId) {
                    select.value = activeId;
                    renderOptions(false);
                    select.value = activeId;
                }

                console.log(LOG_PREFIX, '✅ Instances loaded:', { count: state.instances.length, activeId });
            } catch (e) {
                console.error(LOG_PREFIX, '❌ loadInstances error:', e);
                state.instances = [];
                renderOptions(false);
            }
        }

                console.log(LOG_PREFIX, '✅ Instances loaded:', { count: state.instances.length, activeId });
            } catch (e) {
                console.error(LOG_PREFIX, '❌ loadInstances error:', e);
                state.instances = [];
                renderOptions(false);
            }
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            
            // Try multiple selectors for the GHL action bar
            const actionBarSelectors = [
                '.msg-composer-actions',
                '.flex.flex-row.gap-2.items-center.pl-2',
                '[class*="composer-actions"]',
                '[class*="message-composer"] .flex',
                '.hl-text-input-container .flex',
                '.conversation-input-container .flex',
                '[class*="input-container"] .flex.items-center',
            ];
            
            let actionBar = null;
            for (const sel of actionBarSelectors) {
                actionBar = document.querySelector(sel);
                if (actionBar) {
                    console.log(LOG_PREFIX, '✅ Found action bar with selector:', sel);
                    break;
                }
            }
            
            if (!actionBar) {
                // Log available containers for debugging
                const possibleContainers = document.querySelectorAll('[class*="composer"], [class*="input-container"], [class*="message-input"]');
                console.log(LOG_PREFIX, '⚠️ Action bar not found. Possible containers:', possibleContainers.length);
                return;
            }

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = \`display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #ffffff; border: 1px solid \${CONFIG.theme.border}; border-radius: 20px;\`;
            
            // CSS para remover a linha azul e resetar o visual do select
            const styleTag = document.createElement('style');
            styleTag.textContent = \`
                #bridge-instance-selector {
                    border: none !important;
                    background: transparent !important;
                    font-size: 12px;
                    font-weight: 700;
                    color: \${CONFIG.theme.text};
                    cursor: pointer;
                    outline: none !important;
                    box-shadow: none !important;
                    padding-right: 16px;
                    max-width: 150px;
                }
                #bridge-instance-selector:focus, #bridge-instance-selector:active {
                    outline: none !important;
                    box-shadow: none !important;
                    border: none !important;
                }
                #bridge-select-wrapper {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                }
                #bridge-select-wrapper::after {
                    content: '';
                    position: absolute;
                    right: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 0;
                    height: 0;
                    border-left: 4px solid transparent;
                    border-right: 4px solid transparent;
                    border-top: 5px solid \${CONFIG.theme.text};
                    pointer-events: none;
                }
            \`;
            document.head.appendChild(styleTag);

            container.innerHTML = \`
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 8px; height: 8px; background: \${CONFIG.theme.primary}; border-radius: 50%;"></div>
                    <div id="bridge-select-wrapper">
                        <select id="bridge-instance-selector">
                            <option>...</option>
                        </select>
                    </div>
                </div>\`;
            
            actionBar.appendChild(container);
            const select = container.querySelector('select');

            select.addEventListener('mousedown', () => renderOptions(true));
            select.addEventListener('blur', () => renderOptions(false));
            
            select.addEventListener('change', async (e) => {
                const phone = extractPhone();
                const conversationId = extractConversationId();
                const previousName = state.currentInstanceName;
                const newInstance = state.instances.find(i => i.id === e.target.value);
                const newName = (newInstance && newInstance.name) ? newInstance.name : "";
                
                console.log(LOG_PREFIX, '🔄 Instance change detected:', { previousName, newName, instanceId: e.target.value, conversationId });
                
                renderOptions(false);
                
                try {
                    await fetch(CONFIG.save_url, {
                        method: 'POST',
                        headers: FUNCTION_HEADERS,
                        body: JSON.stringify({ 
                            instanceId: e.target.value, 
                            locationId: state.currentLocationId, 
                            phone: phone,
                            conversationId: conversationId,
                            previousInstanceName: previousName,
                            newInstanceName: newName
                        })
                    });
                    
                    // Inject chat notification showing the switch
                    if (previousName && previousName !== newName) {
                        console.log(LOG_PREFIX, '📢 Calling injectChatNotification:', previousName, '→', newName);
                        injectChatNotification(previousName, newName);
                    } else {
                        console.log(LOG_PREFIX, '⚠️ Skipping notification - previousName:', previousName, 'newName:', newName);
                    }
                    
                    // Update current instance name
                    state.currentInstanceName = newName;
                    
                    showNotification(newName);
                } catch (err) { console.error("Erro Save:", err); }
            });

            const p = extractPhone();
            if (p) loadInstances(p);
        }

        setInterval(() => {
            if (window.location.pathname.includes('/conversations')) {
                // Keep currentConversationId fresh for the dropdown handler
                state.currentConversationId = extractConversationId();

                inject();
                const p = extractPhone();
                if (p && p !== state.lastPhoneFound) {
                    state.lastPhoneFound = p;
                    loadInstances(p);
                }
            }
        }, 1500);
    })();
} catch (e) { console.error('Erro Bridge:', e); }
`;

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
