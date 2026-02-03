const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.10.0 - Chat Instance Change Notification
console.log('🚀 BRIDGE LOADER: v6.10.0 Iniciado');

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
            // Find the GHL chat messages container
            const chatContainer = document.querySelector('.conversation-messages-wrapper') || 
                                  document.querySelector('[class*="messages-container"]') ||
                                  document.querySelector('.hl_conversations--messages-renderer');
            
            if (!chatContainer) {
                console.log(LOG_PREFIX, 'Chat container not found for notification');
                return;
            }

            // Remove any existing bridge notifications
            const existing = chatContainer.querySelectorAll('.bridge-switch-notification');
            existing.forEach(el => el.remove());

            // Create the notification element
            const notification = document.createElement('div');
            notification.className = 'bridge-switch-notification';
            notification.style.cssText = \`
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 8px 16px;
                margin: 12px auto;
                max-width: 300px;
                background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                border: 1px solid #86efac;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                color: #166534;
                box-shadow: 0 2px 8px rgba(34, 197, 94, 0.15);
                animation: bridgeFadeIn 0.3s ease-out;
            \`;
            
            notification.innerHTML = \`
                <span style="margin-right: 6px;">🔄</span>
                <span style="color: #dc2626; font-weight: 700;">\${fromInstance}</span>
                <span style="margin: 0 8px; color: #9ca3af;">→</span>
                <span style="color: #16a34a; font-weight: 700;">\${toInstance}</span>
            \`;

            // Add animation keyframes if not already present
            if (!document.getElementById('bridge-animation-styles')) {
                const animStyle = document.createElement('style');
                animStyle.id = 'bridge-animation-styles';
                animStyle.textContent = \`
                    @keyframes bridgeFadeIn {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                \`;
                document.head.appendChild(animStyle);
            }

            // Insert at the end of the chat
            chatContainer.appendChild(notification);
            
            // Auto-scroll to show the notification
            notification.scrollIntoView({ behavior: 'smooth', block: 'end' });
            
            console.log(LOG_PREFIX, 'Chat notification injected:', fromInstance, '→', toInstance);
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
                renderOptions(false);
                
                try {
                    await fetch(CONFIG.save_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instanceId: e.target.value, locationId: state.currentLocationId, phone: phone })
                    });
                    
                    // Inject chat notification showing the switch
                    if (previousName && previousName !== newName) {
                        injectChatNotification(previousName, newName);
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
