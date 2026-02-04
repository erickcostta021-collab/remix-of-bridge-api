const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_TOOLKIT_SCRIPT = `
// 🛠️ BRIDGE TOOLKIT v9.1 - Menu Fixo WhatsApp Style
console.log('🛠️ BRIDGE TOOLKIT v9.1 Iniciado');

(function() {
    const BRIDGE_CONFIG = {
        supabase_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co'
    };

    // --- 1. FUNÇÕES DE AÇÃO ---
    const actions = {
        copy: (text) => {
            navigator.clipboard.writeText(text);
            // Notificação simples
            const toast = document.createElement('div');
            toast.innerText = "Copiado!";
            toast.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#333; color:white; padding:8px 16px; border-radius:20px; z-index:100000;";
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        },
        delete: async (ghlId) => {
            if (confirm("Apagar para todos?")) {
                await window.processMessageAction('delete', ghlId);
            }
        }
    };

    // --- 2. CRIAÇÃO DO MENU ---
    window.openBridgeMenu = (e, triggerEl) => {
        e.preventDefault();
        e.stopPropagation();

        const msgEl = triggerEl.closest('.message-group') || triggerEl.parentElement;
        const ghlId = msgEl.getAttribute('data-id') || "temp-id";
        const msgText = msgEl.querySelector('.message-body-text')?.innerText || "";

        // Remove menu anterior se existir
        const prev = document.getElementById('bridge-whatsapp-menu');
        if (prev) prev.remove();

        const menu = document.createElement('div');
        menu.id = 'bridge-whatsapp-menu';
        
        // Posicionamento Dinâmico perto do clique
        const rect = triggerEl.getBoundingClientRect();
        
        menu.style.cssText = \`
            position: fixed; 
            top: \${rect.bottom + 5}px; 
            left: \${rect.left - 180}px; 
            z-index: 99999;
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.2); 
            width: 240px;
            animation: menuPop 0.15s ease-out;
            border: 1px solid #f0f0f0;
        \`;

        menu.innerHTML = \`
            <div style="display:flex; justify-content:space-around; padding:12px; border-bottom:1px solid #f0f0f0;">
                \${['👍', '❤️', '😂', '😮', '😢', '🙏'].map(em => \`<span class="em-btn" style="cursor:pointer; font-size:22px;">\${em}</span>\`).join('')}
                <span style="cursor:pointer; font-size:18px; color:#666; background:#f0f0f0; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">＋</span>
            </div>
            <div class="menu-opt" data-act="reply" style="padding:12px 16px; cursor:pointer; display:flex; align-items:center; gap:12px;"><span>↩️</span> Responder</div>
            <div class="menu-opt" data-act="copy" style="padding:12px 16px; cursor:pointer; display:flex; align-items:center; gap:12px;"><span>📋</span> Copiar</div>
            <div class="menu-opt" data-act="edit" style="padding:12px 16px; cursor:pointer; display:flex; align-items:center; gap:12px;"><span>✏️</span> Editar</div>
            <div class="menu-opt" data-act="delete" style="padding:12px 16px; cursor:pointer; display:flex; align-items:center; gap:12px; color:#ef4444;"><span>🗑️</span> Apagar</div>
        \`;

        document.body.appendChild(menu);

        // Listeners de Emoji
        menu.querySelectorAll('.em-btn').forEach(btn => {
            btn.onclick = () => {
                window.processMessageAction('react', ghlId, { emoji: btn.innerText });
                menu.remove();
            };
        });

        // Listeners de Opções
        menu.querySelectorAll('.menu-opt').forEach(opt => {
            opt.onmouseover = () => opt.style.background = "#f5f5f5";
            opt.onmouseout = () => opt.style.background = "transparent";
            opt.onclick = () => {
                const act = opt.getAttribute('data-act');
                if(act === 'copy') actions.copy(msgText);
                if(act === 'delete') actions.delete(ghlId);
                if(act === 'edit') window.triggerEdit && window.triggerEdit(triggerEl);
                menu.remove();
            };
        });

        // Fechar ao clicar fora
        const closeMenu = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); } };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    };

    // --- 3. PROCESSADOR DE AÇÕES (Backend) ---
    window.processMessageAction = async function(action, ghlId, data = {}) {
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

    // --- 4. INJEÇÃO DOS BOTÕES ---
    const inject = () => {
        // O GHL usa várias classes, tentamos as mais comuns
        const messages = document.querySelectorAll('.message-group:not(.bridge-v9), .message-container:not(.bridge-v9)');
        
        messages.forEach(msg => {
            msg.classList.add('bridge-v9');
            msg.style.setProperty('position', 'relative', 'important');

            const btn = document.createElement('div');
            btn.className = 'bridge-trigger';
            btn.innerHTML = '▼';
            btn.style.cssText = \`
                position: absolute; top: 5px; right: 5px; 
                width: 24px; height: 24px; background: #f0f2f5;
                border-radius: 50%; display: flex; align-items: center; 
                justify-content: center; cursor: pointer; z-index: 10;
                opacity: 0; transition: 0.2s; font-size: 10px; color: #54656f;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            \`;
            
            msg.onmouseenter = () => btn.style.opacity = '1';
            msg.onmouseleave = () => btn.style.opacity = '0';
            
            btn.onclick = (e) => window.openBridgeMenu(e, btn);
            msg.appendChild(btn);
        });
    };

    // --- 5. INICIALIZAÇÃO ---
    const style = document.createElement('style');
    style.textContent = \`@keyframes menuPop { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }\`;
    document.head.appendChild(style);

    setInterval(inject, 1500);
    console.log('[Toolkit] ✅ v9.1 Initialization complete');
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
