const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_TOOLKIT_SCRIPT = `
// 🛠️ BRIDGE TOOLKIT v8.0 - Edição, Reações, Deleção, Respostas
console.log('🛠️ BRIDGE TOOLKIT v8.0 Iniciado');

(function() {
    const BRIDGE_CONFIG = {
        supabase_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co',
        edit_limit_minutes: 15
    };

    // --- 1. REALTIME LISTENER ---
    let realtimeChannel = null;
    
    async function initRealtime() {
        try {
            // Use Supabase Realtime via WebSocket
            const ws = new WebSocket('wss://jsupvprudyxyiyxwqxuq.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdXB2cHJ1ZHl4eWl5eHdxeHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzMwNDAsImV4cCI6MjA4NDUwOTA0MH0._Ge7hb5CHCE6mchtjGLbWXx5Q9i_D7P0dn7OlMYlvyM&vsn=1.0.0');
            
            ws.onopen = () => {
                console.log('[Toolkit] ✅ Realtime conectado');
                // Subscribe to ghl_updates channel
                ws.send(JSON.stringify({
                    topic: 'realtime:ghl_updates',
                    event: 'phx_join',
                    payload: {},
                    ref: '1'
                }));
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.event === 'broadcast' && data.payload?.event === 'msg_update') {
                        handleMessageUpdate(data.payload.payload);
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            };
            
            ws.onerror = (e) => console.error('[Toolkit] WebSocket error:', e);
            ws.onclose = () => {
                console.log('[Toolkit] WebSocket closed, reconnecting in 5s...');
                setTimeout(initRealtime, 5000);
            };
        } catch (e) {
            console.error('[Toolkit] Failed to init realtime:', e);
        }
    }
    
    function handleMessageUpdate(payload) {
        const { ghl_id, type, new_text, emoji, fromMe, replyData } = payload;
        console.log('[Toolkit] 📩 Received update:', { ghl_id, type });
        
        const msgEl = document.querySelector(\`[data-id="\${ghl_id}"]\`) || 
                      document.querySelector(\`[data-message-id="\${ghl_id}"]\`);
        if (!msgEl) {
            console.log('[Toolkit] Message element not found:', ghl_id);
            return;
        }

        if (type === 'edit') {
            const body = msgEl.querySelector('.message-body-text') || 
                        msgEl.querySelector('[class*="message-text"]') ||
                        msgEl.querySelector('.hl-message-text');
            if (body) {
                body.innerHTML = \`\${new_text} <span style="font-size:10px; color:gray; margin-left:4px;">(editada)</span>\`;
                console.log('[Toolkit] ✏️ Message edited:', ghl_id);
            }
        }
        
        if (type === 'delete') {
            // Only apply visual deletion if it's from the user (fromMe)
            if (fromMe) {
                msgEl.style.opacity = '0.5';
                msgEl.style.textDecoration = 'line-through';
                const body = msgEl.querySelector('.message-body-text') || msgEl;
                body.innerHTML = '🚫 <i>Mensagem apagada</i>';
                console.log('[Toolkit] 🗑️ Message deleted:', ghl_id);
            }
        }

        if (type === 'react') {
            renderReactionBadge(msgEl, emoji);
            console.log('[Toolkit] 😀 Reaction added:', emoji);
        }
        
        if (type === 'reply' && replyData) {
            renderQuotedBox(msgEl, replyData);
            console.log('[Toolkit] ↩️ Reply context added');
        }
    }

    // --- 2. RENDERIZAÇÃO VISUAL (UI) ---
    function renderReactionBadge(el, emoji) {
        let badge = el.querySelector('.bridge-reaction-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'bridge-reaction-badge';
            badge.style.cssText = 'position:absolute; bottom:-10px; right:10px; background:white; border-radius:12px; padding:2px 6px; font-size:12px; box-shadow:0 2px 4px rgba(0,0,0,0.1); border:1px solid #eee; z-index:10;';
            el.style.position = 'relative';
            el.appendChild(badge);
        }
        badge.innerHTML = emoji;
    }

    function renderQuotedBox(el, data) {
        if (!data || el.querySelector('.bridge-quoted-container')) return;
        const quote = document.createElement('div');
        quote.className = 'bridge-quoted-container';
        quote.style.cssText = 'background:rgba(0,0,0,0.05); border-left:4px solid #22c55e; border-radius:4px; padding:4px 8px; margin-bottom:4px; font-size:11px; color:#666;';
        quote.innerHTML = \`<div style="font-weight:bold; color:#22c55e;">Resposta a:</div><div>\${data.text}</div>\`;
        const body = el.querySelector('.message-body-text') || el;
        body.prepend(quote);
    }

    // --- 3. MENU DE EMOJIS (WhatsApp Style) ---
    window.bridgeOpenEmojiMenu = function(btn) {
        const msgEl = btn.closest('.message-group') || btn.closest('[data-message-id]') || btn.closest('.hl-message');
        if (!msgEl) return;
        
        const ghlId = msgEl.getAttribute('data-id') || msgEl.getAttribute('data-message-id');
        if (!ghlId) return;
        
        const existing = document.querySelector('.whatsapp-reaction-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'whatsapp-reaction-menu';
        menu.style.cssText = 'display:flex; gap:8px; background:white; padding:6px 12px; border-radius:30px; box-shadow:0 4px 12px rgba(0,0,0,0.15); position:absolute; top:-45px; left:10px; z-index:9999;';

        ['❤️', '👍', '😂', '😮', '😢', '🙏'].forEach(emoji => {
            const s = document.createElement('span');
            s.innerHTML = emoji;
            s.style.cssText = 'cursor:pointer; font-size:20px; transition: transform 0.1s;';
            s.onmouseenter = () => s.style.transform = 'scale(1.2)';
            s.onmouseleave = () => s.style.transform = 'scale(1)';
            s.onclick = async () => {
                renderReactionBadge(msgEl, emoji);
                await window.bridgeProcessAction('react', ghlId, { emoji });
                menu.remove();
            };
            menu.appendChild(s);
        });
        
        msgEl.style.position = 'relative';
        msgEl.appendChild(menu);
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    };

    // --- 4. AÇÃO DE EDITAR ---
    window.bridgeTriggerEdit = async function(el) {
        const msgEl = el.closest('.message-group') || el.closest('[data-message-id]') || el.closest('.hl-message');
        if (!msgEl) return;
        
        const ghlId = msgEl.getAttribute('data-id') || msgEl.getAttribute('data-message-id');
        if (!ghlId) return;
        
        const bodyEl = msgEl.querySelector('.message-body-text') || 
                       msgEl.querySelector('[class*="message-text"]') ||
                       msgEl.querySelector('.hl-message-text');
        const currentText = bodyEl?.innerText || "";
        
        const newText = prompt("Edite sua mensagem (limite de 15 minutos):", currentText);
        if (newText && newText !== currentText) {
            const result = await window.bridgeProcessAction('edit', ghlId, { text: newText });
            if (result?.error) {
                alert(result.error);
            }
        }
    };

    // --- 5. AÇÃO DE DELETAR ---
    window.bridgeTriggerDelete = async function(el) {
        if (!confirm("Apagar mensagem para todos?")) return;
        
        const msgEl = el.closest('.message-group') || el.closest('[data-message-id]') || el.closest('.hl-message');
        if (!msgEl) return;
        
        const ghlId = msgEl.getAttribute('data-id') || msgEl.getAttribute('data-message-id');
        if (!ghlId) return;
        
        await window.bridgeProcessAction('delete', ghlId, { from_me: true });
    };

    // --- 6. PROCESSADOR DE AÇÕES ---
    window.bridgeProcessAction = async function(action, ghlId, data = {}) {
        try {
            const response = await fetch(\`\${BRIDGE_CONFIG.supabase_url}/functions/v1/map-messages\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    ghl_id: ghlId,
                    ...data
                })
            });
            
            const result = await response.json();
            console.log('[Toolkit] Action result:', action, result);
            return result;
        } catch (e) {
            console.error('[Toolkit] Action error:', e);
            return { error: e.message };
        }
    };

    // --- 7. SINCRONIZAÇÃO DE IDs ---
    window.bridgeSyncMessageIds = async function(ghlId, uazapiId, content, locationId) {
        try {
            await fetch(\`\${BRIDGE_CONFIG.supabase_url}/functions/v1/map-messages\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'map',
                    ghl_id: ghlId, 
                    uazapi_id: uazapiId, 
                    text: content, 
                    timestamp: Date.now(),
                    location_id: locationId
                })
            });
        } catch (e) {
            console.error('[Toolkit] Sync error:', e);
        }
    };

    // --- 8. INJEÇÃO DE AÇÕES NAS MENSAGENS ---
    function injectActions() {
        const messages = document.querySelectorAll('.message-group:not(.bridge-toolkit-ready), .hl-message:not(.bridge-toolkit-ready), [data-message-id]:not(.bridge-toolkit-ready)');
        
        messages.forEach(msg => {
            msg.classList.add('bridge-toolkit-ready');
            msg.style.position = 'relative';

            const actionTrigger = document.createElement('div');
            actionTrigger.className = 'bridge-actions-hover';
            actionTrigger.style.cssText = 'position:absolute; top:0; right:-40px; display:flex; gap:5px; opacity:0; transition:0.2s; cursor:pointer; background:white; padding:4px 6px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);';
            actionTrigger.innerHTML = \`
                <span onclick="bridgeOpenEmojiMenu(this)" title="Reagir" style="font-size:14px;">😀</span>
                <span onclick="bridgeTriggerEdit(this)" title="Editar (15min)" style="font-size:14px;">✏️</span>
                <span onclick="bridgeTriggerDelete(this)" title="Apagar" style="font-size:14px;">🗑️</span>
            \`;
            
            msg.onmouseenter = () => actionTrigger.style.opacity = '1';
            msg.onmouseleave = () => actionTrigger.style.opacity = '0';
            msg.appendChild(actionTrigger);
        });
    }

    // --- 9. INICIALIZAÇÃO ---
    function init() {
        console.log('[Toolkit] Initializing...');
        
        // Inject CSS
        const style = document.createElement('style');
        style.textContent = \`
            .bridge-actions-hover span:hover {
                transform: scale(1.2);
            }
            .bridge-reaction-badge {
                animation: bridge-pop 0.3s ease;
            }
            @keyframes bridge-pop {
                0% { transform: scale(0); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
        \`;
        document.head.appendChild(style);
        
        // Start realtime listener
        initRealtime();
        
        // Inject actions periodically
        setInterval(injectActions, 2000);
        
        console.log('[Toolkit] ✅ Initialization complete');
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(BRIDGE_TOOLKIT_SCRIPT, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=60, must-revalidate",
    },
  });
});
