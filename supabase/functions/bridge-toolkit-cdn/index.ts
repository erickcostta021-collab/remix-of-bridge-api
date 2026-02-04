const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_TOOLKIT_SCRIPT = `
// 🛠️ BRIDGE TOOLKIT v10 - Seletores Atualizados GHL
console.log('🛠️ BRIDGE TOOLKIT v10 Iniciado');

(function() {
    const BRIDGE_CONFIG = {
        supabase_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co',
        webhook_endpoint: '/functions/v1/map-messages'
    };

    // Função para disparar Webhook para o Lovable
    const sendWebhook = async (action, ghlId, extra = {}) => {
        console.log(\`📡 Enviando \${action} para ID: \${ghlId}\`);
        try {
            await fetch(BRIDGE_CONFIG.supabase_url + BRIDGE_CONFIG.webhook_endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ghl_id: ghlId, ...extra })
            });
        } catch (e) { console.error("Erro no Webhook:", e); }
    };

    // --- LÓGICA DO MENU ---
    window.openBridgeMenu = (e, triggerEl) => {
        e.preventDefault();
        e.stopPropagation();

        const parentItem = triggerEl.closest('.message-item');
        const ghlId = parentItem?.getAttribute('data-message-id') || 'unknown';
        const msgContainer = triggerEl.closest('.message-container');
        const isOutbound = msgContainer?.classList.contains('ml-auto') || false;
        const msgText = parentItem?.querySelector('.text-\\\\[14px\\\\]')?.innerText || "";
        
        // Cálculo de tempo para Edição (15 min)
        const timeText = parentItem?.querySelector('.cursor-pointer')?.innerText;
        const isEditable = checkTimeLimit(timeText);

        const prev = document.getElementById('bridge-whatsapp-menu');
        if (prev) prev.remove();

        const menu = document.createElement('div');
        menu.id = 'bridge-whatsapp-menu';
        
        // Posicionamento Inteligente
        const rect = triggerEl.getBoundingClientRect();
        let topPos = rect.bottom + 5;
        let leftPos = isOutbound ? rect.left - 200 : rect.left;

        // Se estiver muito no topo, abre invertido (para baixo)
        if (rect.top < 300) {
            topPos = rect.bottom + 5;
        } else {
            topPos = rect.top - 240;
        }

        menu.style.cssText = \`
            position: fixed; top: \${topPos}px; left: \${leftPos}px; z-index: 99999;
            background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); 
            width: 240px; animation: menuPop 0.15s ease-out; border: 1px solid #f0f0f0;
        \`;

        menu.innerHTML = \`
            <div style="display:flex; justify-content:space-around; padding:12px; border-bottom:1px solid #f0f0f0;">
                \${['👍', '❤️', '😂', '😮', '😢', '🙏'].map(em => \`<span class="em-btn" style="cursor:pointer; font-size:22px;">\${em}</span>\`).join('')}
                <span class="plus-btn" style="cursor:pointer; font-size:18px; color:#666; background:#f0f0f0; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">＋</span>
            </div>
            <div class="menu-opt" data-act="reply" style="padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:12px;"><span>↩️</span> Responder</div>
            <div class="menu-opt" data-act="copy" style="padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:12px;"><span>📋</span> Copiar</div>
            \${isEditable ? \`<div class="menu-opt" data-act="edit" style="padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:12px;"><span>✏️</span> Editar</div>\` : ''}
            <div class="menu-opt" data-act="delete" style="padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:12px; color:#ef4444;"><span>🗑️</span> Apagar</div>
        \`;

        document.body.appendChild(menu);

        // Listeners
        menu.querySelectorAll('.em-btn').forEach(btn => {
            btn.onclick = () => { sendWebhook('react', ghlId, { emoji: btn.innerText }); menu.remove(); };
        });

        menu.querySelector('.plus-btn').onclick = () => { alert("Escolha no celular (limitação API)"); menu.remove(); };

        menu.querySelectorAll('.menu-opt').forEach(opt => {
            opt.onclick = () => {
                const act = opt.getAttribute('data-act');
                if(act === 'copy') navigator.clipboard.writeText(msgText);
                if(act === 'delete' && confirm("Apagar?")) sendWebhook('delete', ghlId);
                if(act === 'edit') {
                    const NewT = prompt("Editar:", msgText);
                    if(NewT) sendWebhook('edit', ghlId, { new_text: NewT });
                }
                if(act === 'reply') sendWebhook('reply', ghlId, { text: msgText });
                menu.remove();
            };
        });

        const closeMenu = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); } };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    };

    // Auxiliar para checar os 15 minutos
    const checkTimeLimit = (timeStr) => {
        if (!timeStr) return true;
        try {
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':');
            if (modifier === 'PM' && hours !== '12') hours = parseInt(hours) + 12;
            if (modifier === 'AM' && hours === '12') hours = '00';
            const msgDate = new Date();
            msgDate.setHours(hours, minutes, 0);
            const diff = (new Date() - msgDate) / 1000 / 60;
            return diff < 15;
        } catch (e) { return true; }
    };

    // Injeta triggers nos containers de mensagem
    const inject = () => {
        document.querySelectorAll('.message-container:not(.bridge-v10)').forEach(msg => {
            msg.classList.add('bridge-v10');
            const isOutbound = msg.classList.contains('ml-auto');
            
            const btn = document.createElement('div');
            btn.className = 'bridge-trigger';
            btn.innerHTML = '▼';
            btn.style.cssText = \`
                position: absolute; top: 5px; 
                \${isOutbound ? 'left: -30px;' : 'right: -30px;'} 
                width: 24px; height: 24px; background: #f0f2f5;
                border-radius: 50%; display: flex; align-items: center; 
                justify-content: center; cursor: pointer; z-index: 10;
                opacity: 0; transition: 0.2s; font-size: 10px; color: #54656f;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            \`;
            
            msg.parentElement.style.position = 'relative';
            msg.onmouseenter = () => btn.style.opacity = '1';
            msg.onmouseleave = () => btn.style.opacity = '0';
            btn.onclick = (e) => window.openBridgeMenu(e, btn);
            msg.appendChild(btn);
        });
    };

    // Estilo de animação
    const style = document.createElement('style');
    style.textContent = \`@keyframes menuPop { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }\`;
    document.head.appendChild(style);

    setInterval(inject, 1500);
    console.log('[Toolkit] ✅ v10 Initialization complete');
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
