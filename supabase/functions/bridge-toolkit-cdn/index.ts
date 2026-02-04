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
    const showReplyBanner = (msgText, ghlId, locationId) => {
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
        
        replyContext = { ghlId, text: msgText, locationId };
        inputArea.focus();
    };

    // Send reply action to backend
    const sendReply = async (replyText) => {
        if (!replyContext) return null;
        
        const { ghlId, locationId } = replyContext;
        console.log(\`↩️ Sending reply to \${ghlId} with text: \${replyText.substring(0, 50)}...\`);
        
        try {
            const url = BRIDGE_CONFIG.supabase_url + BRIDGE_CONFIG.endpoint;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'reply', 
                    ghl_id: ghlId, 
                    text: replyText,
                    location_id: locationId
                })
            });
            
            const data = await response.json();
            console.log("↩️ Reply response:", data);
            
            if (data.success) {
                showToast("Resposta enviada no WhatsApp!");
                return data;
            } else {
                showToast("Erro: " + (data.error || "Falha ao responder"), true);
                return null;
            }
        } catch (e) {
            console.error("❌ Reply error:", e);
            showToast("Erro de conexão: " + e.message, true);
            return null;
        }
    };

    // Find the active message input (GHL uses various input types)
    const findMessageInput = () => {
        // Try multiple selectors used by GHL
        const selectors = [
            'textarea[placeholder*="Type"]',
            'textarea[placeholder*="type"]',
            'textarea[placeholder*="Message"]',
            'textarea[placeholder*="message"]',
            'textarea',
            '[contenteditable="true"]',
            'input[type="text"]'
        ];
        
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && (el.offsetParent !== null)) { // visible
                return el;
            }
        }
        return document.activeElement;
    };
    
    // Get text from input element
    const getInputText = (el) => {
        if (!el) return '';
        if (el.value !== undefined && el.value !== '') return el.value;
        if (el.innerText) return el.innerText;
        if (el.textContent) return el.textContent;
        return '';
    };
    
    // Clear input element
    const clearInput = (el) => {
        if (!el) return;
        if (el.value !== undefined) {
            el.value = '';
        } else if (el.innerText !== undefined) {
            el.innerText = '';
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Intercept keyboard Enter and send buttons to handle replies
    const interceptSendActions = () => {
        // Use document-level capture to intercept before GHL
        if (window.bridgeDocumentInterceptorAttached) return;
        window.bridgeDocumentInterceptorAttached = true;
        
        console.log("🎯 Bridge: Attaching document-level interceptors...");
        
        // Capture Enter key at document level
        document.addEventListener('keydown', async (e) => {
            // Only intercept Enter (not Shift+Enter)
            if (e.key !== 'Enter' || e.shiftKey) return;
            
            // Only if we have a reply context
            if (!replyContext) {
                console.log("⏭️ Bridge: Enter pressed but no reply context, skipping");
                return;
            }
            
            const inputArea = findMessageInput();
            const text = getInputText(inputArea);
            
            console.log("🔑 Bridge: Enter detected!", { 
                hasReplyContext: !!replyContext, 
                text: text.substring(0, 50),
                inputTag: inputArea?.tagName,
                activeElement: document.activeElement?.tagName
            });
            
            if (text.trim()) {
                // CRITICAL: Stop the event before it reaches GHL
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                console.log("📤 Bridge: Intercepted! Sending reply to WhatsApp...");
                showToast("Enviando resposta...");
                
                const result = await sendReply(text.trim());
                
                if (result) {
                    console.log("✅ Bridge: Reply sent successfully");
                    clearInput(inputArea);
                    clearReplyContext();
                } else {
                    console.log("❌ Bridge: Reply failed");
                }
            }
        }, true); // Capture phase - runs BEFORE bubbling
        
        // Also capture clicks on send buttons - more aggressive detection
        document.addEventListener('click', async (e) => {
            // Only if we have a reply context
            if (!replyContext) return;
            
            const target = e.target;
            
            // Try to find a button or clickable element
            const btn = target.closest('button, [role="button"], [data-testid*="send"], [class*="send"]');
            
            // Also check if we clicked directly on SVG/icon inside button
            const svgParent = target.closest('svg')?.closest('button, [role="button"]');
            const clickedElement = btn || svgParent;
            
            // Also detect based on location near input area
            const inputArea = findMessageInput();
            const isNearInput = inputArea && (() => {
                const inputRect = inputArea.getBoundingClientRect();
                const clickX = e.clientX;
                const clickY = e.clientY;
                // Button is likely to the right of or below the input
                return Math.abs(clickY - inputRect.bottom) < 100 && 
                       clickX > inputRect.right - 100;
            })();
            
            if (!clickedElement && !isNearInput) return;
            
            // Check if it looks like a send button
            let isSendButton = false;
            
            if (clickedElement) {
                const hasSendIcon = clickedElement.querySelector('svg');
                const btnText = (clickedElement.textContent || '').toLowerCase();
                const btnClass = (clickedElement.className || '').toLowerCase();
                const ariaLabel = (clickedElement.getAttribute('aria-label') || '').toLowerCase();
                
                isSendButton = hasSendIcon || 
                    btnText.includes('send') || btnText.includes('enviar') ||
                    btnClass.includes('send') || 
                    ariaLabel.includes('send') || ariaLabel.includes('enviar');
                    
                console.log("🔍 Bridge: Button analysis", {
                    hasSendIcon: !!hasSendIcon,
                    btnText,
                    btnClass,
                    ariaLabel,
                    isSendButton
                });
            }
            
            // If near input and clicked something clickable, assume it could be send
            if (isNearInput && (target.closest('button') || target.closest('svg'))) {
                isSendButton = true;
                console.log("🔍 Bridge: Assuming send button due to location near input");
            }
            
            if (!isSendButton) return;
            
            const text = getInputText(inputArea);
            
            console.log("🖱️ Bridge: Send button clicked!", { 
                hasReplyContext: !!replyContext, 
                text: text.substring(0, 50),
                buttonClass: clickedElement?.className || 'unknown',
                isNearInput
            });
            
            if (text.trim()) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                console.log("📤 Bridge: Sending reply via button...");
                showToast("Enviando resposta...");
                
                const result = await sendReply(text.trim());
                
                if (result) {
                    console.log("✅ Bridge: Reply sent successfully via button");
                    clearInput(inputArea);
                    clearReplyContext();
                }
            }
        }, true); // Capture phase
        
        console.log("✅ Bridge: Document-level interceptors attached successfully");
    };
    
    // Helper to clear reply context and banner
    const clearReplyContext = () => {
        const banner = document.getElementById('bridge-reply-banner');
        if (banner) banner.remove();
        replyContext = null;
        console.log("🧹 Bridge: Reply context cleared");
        console.log("✅ Reply context cleared");
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

        const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
        const allEmojis = [
            // Smileys & Emotion
            '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲',
            '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
            '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟',
            '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
            '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽',
            '🙀', '😿', '😾', '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️‍🔥', '❤️‍🩹', '❤️', '🧡',
            '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤',
            // Gestures & Body Parts
            '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊',
            '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀',
            '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓', '👴', '👵',
            // Animals & Nature
            '🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐕‍🦺', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈', '🐈‍⬛', '🦁', '🐯', '🐅', '🐆', '🐴', '🐎', '🦄',
            '🦓', '🦌', '🦬', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽', '🐏', '🐑', '🐐', '🐪', '🐫', '🦙', '🦒', '🐘', '🦣', '🦏', '🦛',
            '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🐿️', '🦫', '🦔', '🦇', '🐻', '🐻‍❄️', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘', '🦡', '🐾', '🦃', '🐔',
            '🐓', '🐣', '🐤', '🐥', '🐦', '🐧', '🕊️', '🦅', '🦆', '🦢', '🦉', '🦤', '🪶', '🦩', '🦚', '🦜', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲',
            '🐉', '🦕', '🦖', '🐳', '🐋', '🐬', '🦭', '🐟', '🐠', '🐡', '🦈', '🐙', '🐚', '🐌', '🦋', '🐛', '🐜', '🐝', '🪲', '🐞', '🦗', '🪳',
            '🕷️', '🕸️', '🦂', '🦟', '🪰', '🪱', '🦠', '💐', '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲', '🌳', '🌴',
            '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓',
            '🫐', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰',
            // Food & Drink
            '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙',
            '🧆', '🥚', '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣',
            '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦀', '🦞', '🦐', '🦑', '🦪', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫',
            '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋', '🧃', '🧉', '🧊',
            // Activities & Sports
            '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹',
            '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇',
            '⛑️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘',
            '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩',
            // Travel & Places
            '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛺', '🚨', '🚔', '🚍',
            '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺',
            '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🪝', '⛽', '🚧', '🚦', '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼',
            '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️',
            '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑',
            '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁',
            // Objects
            '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️',
            '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️',
            '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚',
            '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿',
            '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿',
            '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️',
            '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️',
            '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️',
            '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️',
            '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓',
            // Symbols
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️',
            '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️',
            '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️',
            '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕',
            '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️',
            '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁',
            '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
            '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️',
            '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰',
            '♾️', '💲', '💱', '™️', '©️', '®️', '👁️‍🗨️', '🔚', '🔙', '🔛', '🔝', '🔜', '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢',
            '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨',
            '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏',
            '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧',
            // Flags (common ones)
            '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇧🇷', '🇺🇸', '🇬🇧', '🇪🇸', '🇫🇷', '🇩🇪', '🇮🇹', '🇵🇹', '🇯🇵', '🇨🇳', '🇰🇷', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱'
        ];
        
        menu.innerHTML = \`
            <div id="emoji-quick" style="display:flex; justify-content:space-around; align-items:center; padding:12px; border-bottom:1px solid #f0f0f0;">
                \${quickEmojis.map(em => \`<span class="em-btn" style="cursor:pointer; font-size:22px; transition:transform 0.1s;" title="Reagir com \${em}">\${em}</span>\`).join('')}
                <span id="emoji-expand" style="cursor:pointer; font-size:14px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:#9ca3af; color:white; border-radius:50%; transition:background 0.2s;" title="Mais emojis">+</span>
            </div>
            <div id="emoji-more" style="display:none; flex-wrap:wrap; justify-content:flex-start; gap:4px; padding:12px; border-bottom:1px solid #f0f0f0; max-height:200px; overflow-y:auto;">
                \${allEmojis.map(em => \`<span class="em-btn" style="cursor:pointer; font-size:20px; transition:transform 0.1s; padding:2px;" title="Reagir com \${em}">\${em}</span>\`).join('')}
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

        // Expand emoji button
        const expandBtn = menu.querySelector('#emoji-expand');
        const morePanel = menu.querySelector('#emoji-more');
        let emojiExpanded = false;
        
        if (expandBtn && morePanel) {
            expandBtn.onclick = (e) => {
                e.stopPropagation();
                emojiExpanded = !emojiExpanded;
                morePanel.style.display = emojiExpanded ? 'flex' : 'none';
                expandBtn.innerText = emojiExpanded ? '➖' : '➕';
                expandBtn.style.background = emojiExpanded ? '#e0e0e0' : '#f0f0f0';
            };
        }

        // Emoji hover effect
        menu.querySelectorAll('.em-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.2)');
            btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
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
                    // Extract location_id from URL or DOM
                    const urlMatch = window.location.href.match(/location[_/]?([a-zA-Z0-9]+)/i);
                    const locationId = urlMatch ? urlMatch[1] : null;
                    
                    if (!locationId) {
                        showToast("Não foi possível identificar a subconta", true);
                        return;
                    }
                    
                    showReplyBanner(msgText, ghlId, locationId);
                    showToast("Digite sua resposta e envie normalmente");
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
        // Also intercept send buttons and keys for replies
        interceptSendActions();
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
    console.log("✅ Bridge Toolkit v14 carregado (com Reply WhatsApp)!");
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
