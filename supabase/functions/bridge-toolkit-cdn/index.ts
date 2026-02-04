const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_TOOLKIT_SCRIPT = `
(function() {
    console.log("🚀 Bridge Toolkit v13: Iniciando...");

    const BRIDGE_CONFIG = {
        supabase_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co',
        endpoint: '/functions/v1/map-messages'
    };

    let replyContext = null; // Stores message being replied to

    const showToast = (msg, isError = false) => {
        const toast = document.createElement('div');
        toast.innerText = msg;
        toast.style.cssText = \`
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: \${isError ? '#ef4444' : '#333'}; color: #fff; padding: 10px 20px; border-radius: 8px;
            z-index: 999999; font-size: 14px; font-family: sans-serif;
        \`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    };

    const sendAction = async (action, ghlId, extra = {}) => {
        console.log(\`📡 Bridge Toolkit - Ação: \${action} | GHL ID: \${ghlId}\`, extra);
        try {
            const url = BRIDGE_CONFIG.supabase_url + BRIDGE_CONFIG.endpoint;
            console.log("📤 Enviando para:", url);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ghl_id: ghlId, ...extra })
            });
            
            console.log("📥 Response status:", response.status);
            const data = await response.json();
            console.log("📥 Response data:", data);
            
            if (data.success) {
                console.log("✅ Ação executada com sucesso:", action);
                return data;
            } else {
                console.error("❌ Erro na ação:", data.error);
                if (data.error === "Message not found") {
                    showToast("Mensagem não mapeada. Envie uma nova mensagem primeiro.", true);
                } else if (data.error && data.error.includes("15 minutes")) {
                    showToast("Não é possível editar mensagens com mais de 15 minutos.", true);
                } else {
                    showToast("Erro: " + (data.error || "Falha na operação"), true);
                }
                return null;
            }
        } catch (e) {
            console.error("❌ Erro de conexão:", e);
            showToast("Erro de conexão: " + e.message, true);
            return null;
        }
    };

    // Show reply banner in input area
    const showReplyBanner = (msgText, ghlId) => {
        const existingBanner = document.getElementById('bridge-reply-banner');
        if (existingBanner) existingBanner.remove();
        
        const inputArea = document.querySelector('textarea, [contenteditable="true"]');
        if (!inputArea) return;
        
        const banner = document.createElement('div');
        banner.id = 'bridge-reply-banner';
        banner.style.cssText = \`
            background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 8px 12px;
            margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between;
            align-items: center; font-family: sans-serif; font-size: 13px;
        \`;
        banner.innerHTML = \`
            <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80%;">
                <span style="color:#0ea5e9; font-weight:600;">↩️ Respondendo:</span>
                <span style="color:#666; margin-left:8px;">\${msgText.substring(0, 50)}\${msgText.length > 50 ? '...' : ''}</span>
            </div>
            <span id="cancel-reply" style="cursor:pointer; color:#999; font-size:18px;">✕</span>
        \`;
        
        inputArea.parentElement.insertBefore(banner, inputArea);
        
        document.getElementById('cancel-reply').onclick = () => {
            banner.remove();
            replyContext = null;
        };
        
        replyContext = { ghlId, text: msgText };
        inputArea.focus();
    };

    window.openBridgeMenu = (e, triggerEl) => {
        e.preventDefault();
        e.stopPropagation();

        const parentItem = triggerEl.closest('[data-message-id]');
        const ghlId = parentItem ? parentItem.getAttribute('data-message-id') : null;
        const msgContainer = triggerEl.closest('.message-container');
        const isOutbound = msgContainer ? msgContainer.classList.contains('ml-auto') : false;
        
        if (!ghlId) {
            console.error("❌ ID da mensagem não encontrado no DOM");
            showToast("ID da mensagem não encontrado", true);
            return;
        }
        
        console.log("📂 Menu para ID:", ghlId, "| Outbound:", isOutbound);

        const prev = document.getElementById('bridge-whatsapp-menu');
        if (prev) prev.remove();

        const menu = document.createElement('div');
        menu.id = 'bridge-whatsapp-menu';
        
        const rect = triggerEl.getBoundingClientRect();
        const openDown = rect.top < 300;
        const topPos = openDown ? rect.bottom + 5 : rect.top - 300;
        const leftPos = isOutbound ? rect.left - 200 : rect.left;

        menu.style.cssText = \`
            position: fixed; top: \${topPos}px; left: \${leftPos}px; 
            z-index: 999999; background: white; border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.2); width: 240px; 
            border: 1px solid #f0f0f0; font-family: sans-serif;
        \`;

        menu.innerHTML = \`
            <div style="display:flex; justify-content:space-around; padding:12px; border-bottom:1px solid #f0f0f0;">
                \${['👍', '❤️', '😂', '😮', '😢', '🙏'].map(em => \`<span class="em-btn" style="cursor:pointer; font-size:22px;" title="Reagir com \${em}">\${em}</span>\`).join('')}
            </div>
            <div class="menu-opt" data-act="reply" style="padding:12px 16px; cursor:pointer; display:flex; align-items:center; gap:12px; transition: background 0.2s;"><span>↩️</span> Responder</div>
            <div class="menu-opt" data-act="copy" style="padding:12px 16px; cursor:pointer; display:flex; align-items:center; gap:12px; transition: background 0.2s;"><span>📋</span> Copiar</div>
            <div class="menu-opt" data-act="edit" style="padding:12px 16px; cursor:pointer; display:flex; align-items:center; gap:12px; transition: background 0.2s;"><span>✏️</span> Editar</div>
            <div class="menu-opt" data-act="delete" style="padding:12px 16px; cursor:pointer; display:flex; align-items:center; gap:12px; color:#ef4444; transition: background 0.2s;"><span>🗑️</span> Apagar</div>
        \`;

        document.body.appendChild(menu);

        // Hover effect
        menu.querySelectorAll('.menu-opt').forEach(opt => {
            opt.addEventListener('mouseenter', () => opt.style.background = '#f5f5f5');
            opt.addEventListener('mouseleave', () => opt.style.background = 'transparent');
        });

        // Get message text from DOM
        const msgText = parentItem.querySelector('.text-\\\\[14px\\\\]')?.innerText || 
                        parentItem.querySelector('[class*="text-"]')?.innerText || 
                        parentItem.innerText?.substring(0, 200) || "";

        // Emoji reactions
        menu.querySelectorAll('.em-btn').forEach(btn => {
            btn.onclick = async () => {
                const emoji = btn.innerText;
                menu.remove();
                const result = await sendAction('react', ghlId, { emoji });
                if (result) showToast(\`Reagiu com \${emoji}\`);
            };
        });

        // Menu options
        menu.querySelectorAll('.menu-opt').forEach(opt => {
            opt.onclick = async () => {
                const act = opt.getAttribute('data-act');
                menu.remove();
                
                if (act === 'reply') {
                    showReplyBanner(msgText, ghlId);
                    showToast("Digite sua resposta abaixo");
                    return;
                }
                
                if (act === 'copy') {
                    navigator.clipboard.writeText(msgText);
                    showToast("Copiado!");
                    return;
                }
                
                if (act === 'edit') {
                    const newText = prompt("Editar mensagem:", msgText);
                    if (newText && newText !== msgText) {
                        const result = await sendAction('edit', ghlId, { new_text: newText });
                        if (result) showToast("Mensagem editada!");
                    }
                    return;
                }
                
                if (act === 'delete') {
                    if (confirm("Apagar esta mensagem para todos?")) {
                        const result = await sendAction('delete', ghlId, { from_me: isOutbound });
                        if (result) showToast("Mensagem apagada!");
                    }
                    return;
                }
            };
        });

        // Close on outside click
        const outClick = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('click', outClick);
            }
        };
        setTimeout(() => document.addEventListener('click', outClick), 50);
    };

    const inject = () => {
        const containers = document.querySelectorAll('.message-container:not(.bridge-v13)');
        
        containers.forEach(msg => {
            msg.classList.add('bridge-v13');
            const isOutbound = msg.classList.contains('ml-auto');
            
            const btn = document.createElement('div');
            btn.className = 'bridge-trigger-v13';
            btn.innerHTML = '▼';
            btn.style.cssText = \`
                position: absolute; top: 5px; 
                \${isOutbound ? 'left: -32px;' : 'right: -32px;'} 
                width: 26px; height: 26px; background: #ffffff;
                border-radius: 50%; display: flex; align-items: center; 
                justify-content: center; cursor: pointer; z-index: 999;
                opacity: 0; transition: opacity 0.2s; font-size: 12px; color: #54656f;
                box-shadow: 0 2px 5px rgba(0,0,0,0.15); border: 1px solid #e0e0e0;
            \`;
            
            msg.style.setProperty('position', 'relative', 'important');
            
            msg.addEventListener('mouseenter', () => btn.style.opacity = '1');
            msg.addEventListener('mouseleave', () => btn.style.opacity = '0');
            
            btn.onclick = (e) => window.openBridgeMenu(e, btn);
            msg.appendChild(btn);
        });
    };

    // Expose reply context for send button integration
    window.getBridgeReplyContext = () => {
        const ctx = replyContext;
        replyContext = null;
        const banner = document.getElementById('bridge-reply-banner');
        if (banner) banner.remove();
        return ctx;
    };

    setInterval(inject, 1000);
    console.log("✅ Bridge Toolkit v13 carregado!");
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
