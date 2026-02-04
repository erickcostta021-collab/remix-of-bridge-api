const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_TOOLKIT_SCRIPT = `
// 🛠️ BRIDGE TOOLKIT v9.0 - Menu Unificado WhatsApp Style
console.log('🛠️ BRIDGE TOOLKIT v9.0 Iniciado');

(function() {
    const BRIDGE_CONFIG = {
        supabase_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co'
    };

    // --- 1. FUNÇÕES DE AÇÃO ---
    const actions = {
        copy: (text) => {
            navigator.clipboard.writeText(text);
            alert("Copiado!");
        },
        reply: (ghlId, text) => {
            console.log("Responder para:", ghlId);
            // Aqui você dispara a lógica de citação que fizemos antes
        },
        delete: async (ghlId) => {
            if (confirm("Apagar para todos?")) {
                await window.processMessageAction('delete', ghlId);
            }
        }
    };

    // --- 2. CRIAÇÃO DO MENU UNIFICADO ---
    window.openBridgeMenu = (el) => {
        const msgEl = el.closest('.message-group');
        const ghlId = msgEl.getAttribute('data-id');
        const msgText = msgEl.querySelector('.message-body-text')?.innerText || "";

        const existing = document.getElementById('bridge-whatsapp-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'bridge-whatsapp-menu';
        menu.style.cssText = \`
            position: absolute; top: 0; right: 50px; z-index: 10000;
            background: white; border-radius: 12px; overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2); width: 220px;
            animation: menuPop 0.15s ease-out; font-family: sans-serif;
        \`;

        // Parte 1: Emojis (Horizontal)
        const emojiBar = document.createElement('div');
        emojiBar.style.cssText = 'display:flex; justify-content:space-around; padding:12px; border-bottom:1px solid #f0f0f0;';
        ['👍', '❤️', '😂', '😮', '😢', '🙏'].forEach(emoji => {
            const s = document.createElement('span');
            s.innerHTML = emoji;
            s.style.cssText = 'cursor:pointer; font-size:22px; transition:transform 0.1s;';
            s.onclick = () => {
                window.processMessageAction('react', ghlId, { emoji });
                menu.remove();
            };
            s.onmouseover = () => s.style.transform = 'scale(1.2)';
            s.onmouseout = () => s.style.transform = 'scale(1)';
            emojiBar.appendChild(s);
        });

        // Botão +
        const plus = document.createElement('span');
        plus.innerHTML = '＋';
        plus.style.cssText = 'cursor:pointer; font-size:18px; color:#666; background:#f0f0f0; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center;';
        plus.onclick = () => console.log("Seletor completo");
        emojiBar.appendChild(plus);
        menu.appendChild(emojiBar);

        // Parte 2: Opções (Vertical)
        const options = [
            { label: 'Responder', icon: '↩️', act: () => actions.reply(ghlId, msgText) },
            { label: 'Copiar', icon: '📋', act: () => actions.copy(msgText) },
            { label: 'Apagar', icon: '🗑️', color: '#ef4444', act: () => actions.delete(ghlId) }
        ];

        options.forEach(opt => {
            const item = document.createElement('div');
            item.style.cssText = \`
                padding: 10px 16px; cursor: pointer; display: flex; align-items: center; 
                gap: 12px; font-size: 14px; color: \${opt.color || '#333'};
            \`;
            item.innerHTML = \`<span style="font-size:16px;">\${opt.icon}</span> \${opt.label}\`;
            item.onmouseover = () => item.style.background = '#f9f9f9';
            item.onmouseout = () => item.style.background = 'transparent';
            item.onclick = () => { opt.act(); menu.remove(); };
            menu.appendChild(item);
        });

        msgEl.appendChild(menu);

        // Fechar ao clicar fora
        setTimeout(() => {
            document.addEventListener('click', function hide(e) {
                if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', hide); }
            }, { capture: true });
        }, 10);
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

    // --- 4. INJEÇÃO DOS TRIGGERS ---
    const injectTriggers = () => {
        const messages = document.querySelectorAll('.message-group:not(.bridge-v9)');
        messages.forEach(msg => {
            msg.classList.add('bridge-v9');
            msg.style.position = 'relative';

            // Botão de Opções (Seta que aparece no hover)
            const trigger = document.createElement('div');
            trigger.innerHTML = '▼';
            trigger.style.cssText = \`
                position: absolute; top: 10px; right: 10px; cursor: pointer;
                opacity: 0; transition: 0.2s; color: #999; font-size: 10px;
                background: rgba(255,255,255,0.8); border-radius: 50%; width: 20px; height: 20px;
                display: flex; align-items: center; justify-content: center; z-index: 5;
            \`;
            
            msg.onmouseenter = () => trigger.style.opacity = '1';
            msg.onmouseleave = () => trigger.style.opacity = '0';
            trigger.onclick = (e) => { e.stopPropagation(); window.openBridgeMenu(trigger); };
            
            msg.appendChild(trigger);
        });
    };

    // --- 5. INICIALIZAÇÃO ---
    const style = document.createElement('style');
    style.textContent = \`
        @keyframes menuPop {
            from { transform: scale(0.9) translateY(-10px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
        }
    \`;
    document.head.appendChild(style);

    setInterval(injectTriggers, 2000);
    console.log('[Toolkit] ✅ v9.0 Initialization complete');
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
