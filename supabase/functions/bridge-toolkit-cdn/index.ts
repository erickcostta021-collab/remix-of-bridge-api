const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_TOOLKIT_SCRIPT = `
(function() {
    console.log("🚀 Bridge Toolkit: Iniciando...");

    const BRIDGE_CONFIG = {
        supabase_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co',
        webhook_endpoint: '/functions/v1/map-messages'
    };

    const sendWebhook = async (action, ghlId, extra = {}) => {
        console.log(\`📡 Ação: \${action} | ID: \${ghlId}\`);
        try {
            await fetch(BRIDGE_CONFIG.supabase_url + BRIDGE_CONFIG.webhook_endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ghl_id: ghlId, ...extra })
            });
        } catch (e) { console.error("❌ Erro Webhook:", e); }
    };

    window.openBridgeMenu = (e, triggerEl) => {
        e.preventDefault();
        e.stopPropagation();

        const parentItem = triggerEl.closest('[data-message-id]');
        const ghlId = parentItem ? parentItem.getAttribute('data-message-id') : "id-nao-encontrado";
        const msgContainer = triggerEl.closest('.message-container');
        const isOutbound = msgContainer ? msgContainer.classList.contains('ml-auto') : false;
        
        console.log("📂 Abrindo menu para ID:", ghlId);

        const prev = document.getElementById('bridge-whatsapp-menu');
        if (prev) prev.remove();

        const menu = document.createElement('div');
        menu.id = 'bridge-whatsapp-menu';
        
        const rect = triggerEl.getBoundingClientRect();
        const openDown = rect.top < 300;
        const topPos = openDown ? rect.bottom + 5 : rect.top - 240;

        menu.style.cssText = \`
            position: fixed; top: \${topPos}px; 
            left: \${isOutbound ? rect.left - 200 : rect.left}px; 
            z-index: 999999; background: white; border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.2); width: 240px; 
            border: 1px solid #f0f0f0; font-family: sans-serif;
        \`;

        menu.innerHTML = \`
            <div style="display:flex; justify-content:space-around; padding:12px; border-bottom:1px solid #f0f0f0;">
                \${['👍', '❤️', '😂', '😮', '😢', '🙏'].map(em => \`<span class="em-btn" style="cursor:pointer; font-size:22px;">\${em}</span>\`).join('')}
                <span id="btn-plus-emoji" style="cursor:pointer; font-size:18px; color:#666; background:#f0f0f0; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">＋</span>
            </div>
            <div class="menu-opt" data-act="reply" style="padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:12px;"><span>↩️</span> Responder</div>
            <div class="menu-opt" data-act="copy" style="padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:12px;"><span>📋</span> Copiar</div>
            <div class="menu-opt" data-act="edit" style="padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:12px;"><span>✏️</span> Editar</div>
            <div class="menu-opt" data-act="delete" style="padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:12px; color:#ef4444;"><span>🗑️</span> Apagar</div>
        \`;

        document.body.appendChild(menu);

        menu.querySelectorAll('.em-btn').forEach(btn => {
            btn.onclick = () => { sendWebhook('react', ghlId, { emoji: btn.innerText }); menu.remove(); };
        });

        menu.querySelectorAll('.menu-opt').forEach(opt => {
            opt.onclick = () => {
                const act = opt.getAttribute('data-act');
                if(act === 'copy') {
                    const text = parentItem.querySelector('.text-\\\\[14px\\\\]')?.innerText;
                    navigator.clipboard.writeText(text);
                }
                if(act === 'delete') sendWebhook('delete', ghlId);
                if(act === 'edit') {
                    const oldText = parentItem.querySelector('.text-\\\\[14px\\\\]')?.innerText;
                    const newT = prompt("Editar mensagem:", oldText);
                    if(newT) sendWebhook('edit', ghlId, { new_text: newT });
                }
                menu.remove();
            };
        });

        const outClick = (ev) => { if(!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', outClick); }};
        setTimeout(() => document.addEventListener('click', outClick), 50);
    };

    const inject = () => {
        const containers = document.querySelectorAll('.message-container:not(.bridge-v11)');
        
        containers.forEach(msg => {
            msg.classList.add('bridge-v11');
            const isOutbound = msg.classList.contains('ml-auto');
            
            const btn = document.createElement('div');
            btn.className = 'bridge-trigger-v11';
            btn.innerHTML = '▼';
            btn.style.cssText = \`
                position: absolute; top: 5px; 
                \${isOutbound ? 'left: -32px;' : 'right: -32px;'} 
                width: 26px; height: 26px; background: #ffffff;
                border-radius: 50%; display: flex; align-items: center; 
                justify-content: center; cursor: pointer; z-index: 999;
                opacity: 0; transition: opacity 0.2s; font-size: 12px; color: #54656f;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2); border: 1px solid #ddd;
            \`;
            
            msg.style.setProperty('position', 'relative', 'important');
            
            msg.addEventListener('mouseenter', () => btn.style.opacity = '1');
            msg.addEventListener('mouseleave', () => btn.style.opacity = '0');
            
            btn.onclick = (e) => window.openBridgeMenu(e, btn);
            msg.appendChild(btn);
        });
    };

    setInterval(inject, 1000);
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
