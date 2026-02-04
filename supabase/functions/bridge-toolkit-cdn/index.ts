const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_TOOLKIT_SCRIPT = `
(function() {
    console.log("🚀 Bridge Toolkit v12: Iniciando...");

    const BRIDGE_CONFIG = {
        supabase_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co',
        endpoint: '/functions/v1/map-messages'
    };

    const showToast = (msg) => {
        const toast = document.createElement('div');
        toast.innerText = msg;
        toast.style.cssText = \`
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: #333; color: #fff; padding: 10px 20px; border-radius: 8px;
            z-index: 999999; font-size: 14px; font-family: sans-serif;
        \`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    };

    const sendAction = async (action, ghlId, extra = {}) => {
        console.log(\`📡 Ação: \${action} | GHL ID: \${ghlId}\`);
        try {
            const response = await fetch(BRIDGE_CONFIG.supabase_url + BRIDGE_CONFIG.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ghl_id: ghlId, ...extra })
            });
            const data = await response.json();
            if (data.success) {
                console.log("✅ Ação executada:", data);
                return data;
            } else {
                console.error("❌ Erro na ação:", data.error);
                showToast("Erro: " + (data.error || "Falha na operação"));
                return null;
            }
        } catch (e) {
            console.error("❌ Erro de conexão:", e);
            showToast("Erro de conexão");
            return null;
        }
    };

    window.openBridgeMenu = (e, triggerEl) => {
        e.preventDefault();
        e.stopPropagation();

        const parentItem = triggerEl.closest('[data-message-id]');
        const ghlId = parentItem ? parentItem.getAttribute('data-message-id') : null;
        const msgContainer = triggerEl.closest('.message-container');
        const isOutbound = msgContainer ? msgContainer.classList.contains('ml-auto') : false;
        
        if (!ghlId) {
            console.error("❌ ID da mensagem não encontrado");
            return;
        }
        
        console.log("📂 Abrindo menu para ID:", ghlId);

        const prev = document.getElementById('bridge-whatsapp-menu');
        if (prev) prev.remove();

        const menu = document.createElement('div');
        menu.id = 'bridge-whatsapp-menu';
        
        const rect = triggerEl.getBoundingClientRect();
        const openDown = rect.top < 300;
        const topPos = openDown ? rect.bottom + 5 : rect.top - 260;
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
                const msgText = parentItem.querySelector('.text-\\\\[14px\\\\]')?.innerText || "";
                
                menu.remove();
                
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
        const containers = document.querySelectorAll('.message-container:not(.bridge-v12)');
        
        containers.forEach(msg => {
            msg.classList.add('bridge-v12');
            const isOutbound = msg.classList.contains('ml-auto');
            
            const btn = document.createElement('div');
            btn.className = 'bridge-trigger-v12';
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

    setInterval(inject, 1000);
    console.log("✅ Bridge Toolkit v12 carregado!");
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
