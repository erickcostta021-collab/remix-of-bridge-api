const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.14.3 - Based on user reference JS
console.log('🚀 BRIDGE LOADER: v6.14.3 Iniciado');

try {
    (function() {
        const LOG_PREFIX = "[Bridge]";
        const CONFIG = {
            api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
            save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
            theme: { primary: '#22c55e', border: '#d1d5db', text: '#374151' }
        };

        let state = { instances: [], lastPhoneFound: null, currentLocationId: null, currentInstanceName: null, currentConversationId: null };

        function extractConversationId() {
            var urlParams = new URLSearchParams(window.location.search);
            var hashParams = new URLSearchParams(window.location.hash.slice(1));
            var fromParams = urlParams.get('conversationId') || hashParams.get('conversationId');
            if (fromParams && fromParams.length >= 10) return fromParams;

            var parts = window.location.pathname.split('/').filter(Boolean);
            var idxDetail = parts.indexOf('detail');
            if (idxDetail !== -1) {
                var candidate = parts[idxDetail + 1];
                if (candidate && candidate !== 'conversations' && candidate.length >= 10) return candidate;
            }

            var idxConv = parts.lastIndexOf('conversations');
            if (idxConv !== -1) {
                var candidate2 = parts[idxConv + 1];
                if (candidate2 && candidate2 !== 'detail' && candidate2 !== 'conversations' && candidate2.length >= 10) return candidate2;
            }

            return null;
        }

        function cleanPhone(raw) {
            if (!raw) return null;
            var clean = raw.replace(/\\D/g, '');
            if (clean.length === 11 && !clean.startsWith('55')) return '55' + clean;
            return clean.length >= 10 ? clean : null;
        }

        function extractPhone() {
            var input = document.querySelector('input.hr-input-phone');
            if (input && input.value) return cleanPhone(input.value);
            var activeCard = document.querySelector('[data-is-active="true"][phone]');
            if (activeCard) return cleanPhone(activeCard.getAttribute('phone'));
            return null;
        }

        function showNotification(instanceName) {
            var existing = document.getElementById('bridge-notify');
            if (existing) existing.remove();
            var toast = document.createElement('div');
            toast.id = 'bridge-notify';
            toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: #1f2937; color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; border-left: 4px solid ' + CONFIG.theme.primary + '; transition: opacity 0.3s;';
            toast.innerHTML = '✅ Instância <b>' + instanceName + '</b> selecionada.';
            document.body.appendChild(toast);
            setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 3000);
        }

        function injectChatNotification(fromInstance, toInstance) {
            console.log(LOG_PREFIX, '🔄 Attempting to inject chat notification:', fromInstance, '→', toInstance);
            
            var selectors = [
                '.hl_conversations--messages-renderer',
                '.conversation-messages-wrapper',
                '.message-list',
                '.messages-wrapper',
                '[class*="message-list"]',
                '[class*="messages-container"]',
                '[class*="chat-messages"]',
                '.msg-list-container'
            ];
            
            var chatContainer = null;
            for (var i = 0; i < selectors.length; i++) {
                chatContainer = document.querySelector(selectors[i]);
                if (chatContainer) {
                    console.log(LOG_PREFIX, '✅ Found chat container with selector:', selectors[i]);
                    break;
                }
            }
            
            if (!chatContainer) {
                console.log(LOG_PREFIX, '⚠️ Chat container not found, using overlay notification');
                
                var existingOverlay = document.getElementById('bridge-switch-overlay');
                if (existingOverlay) existingOverlay.remove();
                
                var overlay = document.createElement('div');
                overlay.id = 'bridge-switch-overlay';
                overlay.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 10001; padding: 10px 20px; background: #1f2937; color: white; border-radius: 8px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);';
                overlay.innerHTML = '🔄 Instância alterada: <b>' + fromInstance + '</b> → <b>' + toInstance + '</b>';
                document.body.appendChild(overlay);
                
                setTimeout(function() {
                    overlay.style.opacity = '0';
                    overlay.style.transition = 'opacity 0.3s';
                    setTimeout(function() { overlay.remove(); }, 300);
                }, 4000);
                
                return;
            }

            document.querySelectorAll('.bridge-switch-notification').forEach(function(el) { el.remove(); });

            var msgWrapper = document.createElement('div');
            msgWrapper.className = 'bridge-switch-notification hl-message hl-message-outgoing';
            msgWrapper.setAttribute('data-bridge-notification', 'true');
            msgWrapper.style.cssText = 'display: flex; flex-direction: row-reverse; align-items: flex-end; padding: 4px 16px; margin: 4px 0; width: 100%;';
            
            var bubble = document.createElement('div');
            bubble.className = 'hl-message-bubble hl-message-bubble-outgoing';
            bubble.style.cssText = 'background: #3b82f6; color: white; padding: 8px 12px; border-radius: 12px 12px 2px 12px; font-size: 13px; max-width: 70%; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1);';
            bubble.innerHTML = '🔄 Instância alterada: <b>' + fromInstance + '</b> → <b>' + toInstance + '</b>';
            
            msgWrapper.appendChild(bubble);
            chatContainer.appendChild(msgWrapper);
            msgWrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
            
            console.log(LOG_PREFIX, '✅ Chat notification injected as outgoing message');
        }

        function renderOptions(showPhone) {
            var select = document.getElementById('bridge-instance-selector');
            if (!select) return;
            var currentVal = select.value;
            
            var html = '';
            for (var i = 0; i < state.instances.length; i++) {
                var inst = state.instances[i];
                var text = showPhone && inst.phone ? (inst.name + ' (' + inst.phone + ')') : inst.name;
                var selected = inst.id === currentVal ? 'selected' : '';
                html += '<option value="' + inst.id + '" ' + selected + '>' + text + '</option>';
            }
            select.innerHTML = html;
        }

        function loadInstances(phone) {
            var locId = window.location.pathname.match(/location\\/([^\\/]+)/);
            locId = locId ? locId[1] : null;
            if (!locId || !phone) return;
            state.currentLocationId = locId;
            
            fetch(CONFIG.api_url + '?locationId=' + locId + '&phone=' + phone)
                .then(function(res) { return res.json(); })
                .then(function(data) {
                    if (data.instances) {
                        state.instances = data.instances;
                        var activeId = data.activeInstanceId || (data.instances[0] ? data.instances[0].id : null);
                        var activeInstance = null;
                        for (var i = 0; i < data.instances.length; i++) {
                            if (data.instances[i].id === activeId) {
                                activeInstance = data.instances[i];
                                break;
                            }
                        }
                        state.currentInstanceName = activeInstance ? activeInstance.name : null;
                        var select = document.getElementById('bridge-instance-selector');
                        if (select) {
                            select.value = activeId;
                            renderOptions(false);
                            select.value = activeId;
                        }
                    }
                })
                .catch(function(e) { console.error(LOG_PREFIX, e); });
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            var actionBar = document.querySelector('.msg-composer-actions') || 
                            document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');
            if (!actionBar) return;

            var container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #ffffff; border: 1px solid ' + CONFIG.theme.border + '; border-radius: 20px;';
            
            var styleTag = document.createElement('style');
            styleTag.textContent = '#bridge-instance-selector { border: none !important; background: transparent !important; font-size: 12px; font-weight: 700; color: ' + CONFIG.theme.text + '; cursor: pointer; outline: none !important; box-shadow: none !important; appearance: none; -webkit-appearance: none; max-width: 150px; } #bridge-instance-selector:focus, #bridge-instance-selector:active { outline: none !important; box-shadow: none !important; border: none !important; }';
            document.head.appendChild(styleTag);

            container.innerHTML = '<div style="display: flex; align-items: center; gap: 6px;"><div style="width: 8px; height: 8px; background: ' + CONFIG.theme.primary + '; border-radius: 50%;"></div><select id="bridge-instance-selector"><option>...</option></select></div>';
            
            actionBar.appendChild(container);
            var select = container.querySelector('select');

            select.addEventListener('mousedown', function() { renderOptions(true); });
            select.addEventListener('blur', function() { renderOptions(false); });
            
            select.addEventListener('change', function(e) {
                var phone = extractPhone();
                var conversationId = extractConversationId();
                var previousName = state.currentInstanceName;
                var newInstance = null;
                for (var i = 0; i < state.instances.length; i++) {
                    if (state.instances[i].id === e.target.value) {
                        newInstance = state.instances[i];
                        break;
                    }
                }
                var newName = newInstance ? newInstance.name : "";
                
                console.log(LOG_PREFIX, '🔄 Instance change detected:', { previousName: previousName, newName: newName, instanceId: e.target.value, conversationId: conversationId });
                
                renderOptions(false);
                
                fetch(CONFIG.save_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        instanceId: e.target.value, 
                        locationId: state.currentLocationId, 
                        phone: phone,
                        conversationId: conversationId,
                        previousInstanceName: previousName,
                        newInstanceName: newName
                    })
                })
                .then(function() {
                    if (previousName && previousName !== newName) {
                        console.log(LOG_PREFIX, '📢 Calling injectChatNotification:', previousName, '→', newName);
                        injectChatNotification(previousName, newName);
                    }
                    state.currentInstanceName = newName;
                    showNotification(newName);
                })
                .catch(function(err) { console.error("Erro Save:", err); });
            });

            var p = extractPhone();
            if (p) loadInstances(p);
        }

        setInterval(function() {
            if (window.location.pathname.includes('/conversations')) {
                state.currentConversationId = extractConversationId();
                inject();
                var p = extractPhone();
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
