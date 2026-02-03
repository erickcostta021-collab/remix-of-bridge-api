const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.14.0 - GHL Native Outgoing Message Style
console.log('🚀 BRIDGE LOADER: v6.14.0 Iniciado');

try {
    (function() {
        const LOG_PREFIX = "[Bridge]";
        const CONFIG = {
            api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
            save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
            theme: { primary: '#22c55e', border: '#d1d5db', text: '#374151' }
        };

        let state = { instances: [], lastPhoneFound: null, currentLocationId: null, currentInstanceName: null };

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
            
            // Find GHL's message container - look for the actual message list
            const selectors = [
                '.hl_conversations--messages-renderer',
                '.conversation-messages-wrapper',
                '[class*="messages-renderer"]',
                '[class*="message-list"]',
                '.messages-wrapper'
            ];
            
            let chatContainer = null;
            for (const selector of selectors) {
                chatContainer = document.querySelector(selector);
                if (chatContainer) {
                    console.log(LOG_PREFIX, '✅ Found chat container:', selector);
                    break;
                }
            }
            
            if (!chatContainer) {
                console.log(LOG_PREFIX, '⚠️ Chat container not found, using overlay');
                const existingOverlay = document.getElementById('bridge-switch-overlay');
                if (existingOverlay) existingOverlay.remove();
                
                const overlay = document.createElement('div');
                overlay.id = 'bridge-switch-overlay';
                overlay.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 10001; padding: 10px 20px; background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%); color: white; border-radius: 20px; font-size: 13px; font-weight: 500; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);';
                overlay.innerHTML = \`📱 Instância alterada: \${fromInstance} → \${toInstance}\`;
                document.body.appendChild(overlay);
                setTimeout(() => { overlay.style.opacity = '0'; overlay.style.transition = 'opacity 0.3s'; setTimeout(() => overlay.remove(), 300); }, 4000);
                return;
            }

            // Remove existing bridge notifications
            document.querySelectorAll('.bridge-switch-notification').forEach(el => el.remove());

            // Get current time for timestamp
            const now = new Date();
            const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

            // Create message row - mimics GHL outgoing message structure exactly
            const msgRow = document.createElement('div');
            msgRow.className = 'bridge-switch-notification';
            msgRow.style.cssText = \`
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                padding: 6px 16px;
                margin: 8px 0;
            \`;
            
            // Message content with bubble + avatar
            msgRow.innerHTML = \`
                <div style="display: flex; align-items: flex-end; gap: 8px; flex-direction: row-reverse;">
                    <!-- Avatar circle (like GHL's EC avatar) -->
                    <div style="
                        width: 28px;
                        height: 28px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        font-weight: 700;
                        color: white;
                        flex-shrink: 0;
                    ">📱</div>
                    
                    <!-- Message bubble -->
                    <div style="
                        background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
                        color: white;
                        padding: 10px 14px;
                        border-radius: 16px 16px 4px 16px;
                        font-size: 13px;
                        font-weight: 500;
                        max-width: 300px;
                        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
                    ">
                        📱 Instância alterada: \${fromInstance} → \${toInstance}
                    </div>
                </div>
                
                <!-- Timestamp below -->
                <div style="
                    font-size: 11px;
                    color: #9ca3af;
                    margin-top: 4px;
                    margin-right: 40px;
                ">\${timeStr}</div>
            \`;

            // Insert at the end of chat
            chatContainer.appendChild(msgRow);
            
            // Scroll to show the new message
            msgRow.scrollIntoView({ behavior: 'smooth', block: 'end' });
            
            console.log(LOG_PREFIX, '✅ Native-style notification injected');
        }

        function renderOptions(showPhone = false) {
            const select = document.getElementById('bridge-instance-selector');
            if (!select) return;
            const currentVal = select.value;
            
            select.innerHTML = state.instances.map(i => {
                const text = showPhone && i.phone ? \`\${i.name} (\${i.phone})\` : i.name;
                return \`<option value="\${i.id}" \${i.id === currentVal ? 'selected' : ''}>\${text}</option>\`;
            }).join('');
        }

        async function loadInstances(phone) {
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            if (!locId || !phone) return;
            state.currentLocationId = locId;
            try {
                const res = await fetch(\`\${CONFIG.api_url}?locationId=\${locId}&phone=\${phone}\`);
                const data = await res.json();
                if (data.instances) {
                    state.instances = data.instances;
                    const activeId = data.activeInstanceId || data.instances[0]?.id;
                    const activeInstance = data.instances.find(i => i.id === activeId);
                    state.currentInstanceName = activeInstance?.name || null;
                    const select = document.getElementById('bridge-instance-selector');
                    if (select) {
                        select.value = activeId;
                        renderOptions(false);
                        select.value = activeId;
                    }
                }
            } catch (e) { console.error(LOG_PREFIX, e); }
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            const actionBar = document.querySelector('.msg-composer-actions') || 
                              document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
            if (!actionBar) return;

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
                    outline: none !important; /* REMOVE A LINHA AZUL */
                    box-shadow: none !important;
                    appearance: none;
                    -webkit-appearance: none;
                    max-width: 150px;
                }
                #bridge-instance-selector:focus, #bridge-instance-selector:active {
                    outline: none !important;
                    box-shadow: none !important;
                    border: none !important;
                }
            \`;
            document.head.appendChild(styleTag);

            container.innerHTML = \`
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 8px; height: 8px; background: \${CONFIG.theme.primary}; border-radius: 50%;"></div>
                    <select id="bridge-instance-selector">
                        <option>...</option>
                    </select>
                </div>\`;
            
            actionBar.appendChild(container);
            const select = container.querySelector('select');

            select.addEventListener('mousedown', () => renderOptions(true));
            select.addEventListener('blur', () => renderOptions(false));
            
            select.addEventListener('change', async (e) => {
                const phone = extractPhone();
                const previousName = state.currentInstanceName;
                const newInstance = state.instances.find(i => i.id === e.target.value);
                const newName = newInstance?.name || "";
                
                console.log(LOG_PREFIX, '🔄 Instance change detected:', { previousName, newName, instanceId: e.target.value });
                
                renderOptions(false);
                
                try {
                    await fetch(CONFIG.save_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instanceId: e.target.value, locationId: state.currentLocationId, phone: phone })
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
