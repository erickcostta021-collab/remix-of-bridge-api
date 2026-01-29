const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BRIDGE_SWITCHER_SCRIPT = `(function() {
    const VERSION = "6.1.0";
    const LOG_PREFIX = "[Bridge]";
    
    const CONFIG = {
        api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
        save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
        reinject_delay: 400,
        sync_interval: 5000,
        theme: {
            primary: '#22c55e',
            border: '#d1d5db',
            text: '#374151'
        }
    };

    // =====================================================
    // LOGGING PROFISSIONAL
    // =====================================================
    const log = {
        info: (msg, data) => console.log(\`\${LOG_PREFIX} ℹ️ \${msg}\`, data || ''),
        success: (msg, data) => console.log(\`\${LOG_PREFIX} ✅ \${msg}\`, data || ''),
        warn: (msg, data) => console.warn(\`\${LOG_PREFIX} ⚠️ \${msg}\`, data || ''),
        error: (msg, data) => console.error(\`\${LOG_PREFIX} ❌ \${msg}\`, data || ''),
        nav: (msg, data) => console.log(\`\${LOG_PREFIX} 🔄 \${msg}\`, data || ''),
        api: (msg, data) => console.log(\`\${LOG_PREFIX} 📡 \${msg}\`, data || '')
    };

    log.info(\`Switcher v\${VERSION} - SPA-Aware Navigation\`);

    // =====================================================
    // STATE MANAGEMENT
    // =====================================================
    let state = {
        instances: [],
        currentContactId: null,
        currentLocationId: null,
        lastUrl: window.location.href,
        isInjected: false
    };

    // =====================================================
    // STYLES
    // =====================================================
    const style = document.createElement('style');
    style.innerHTML = \`
        #bridge-instance-selector:focus { 
            outline: none !important; 
            box-shadow: none !important; 
            border: 1px solid \${CONFIG.theme.border} !important; 
        }
        #bridge-instance-selector {
            border: none; 
            background: transparent; 
            font-size: 12px; 
            font-weight: 700;
            color: \${CONFIG.theme.text}; 
            cursor: pointer; 
            appearance: none; 
            -webkit-appearance: none;
            padding-right: 4px; 
            width: 100%; 
            max-width: 160px; 
            text-overflow: ellipsis; 
            white-space: nowrap; 
            overflow: hidden;
        }
        #bridge-api-container {
            transition: opacity 0.2s ease;
        }
    \`;
    document.head.appendChild(style);

    // =====================================================
    // URL & NAVIGATION HELPERS
    // =====================================================
    function getContactIdFromUrl() {
        const pathname = window.location.pathname;
        
        // Method 1: /conversations/CONTACT_ID pattern
        const conversationMatch = pathname.match(/\\/conversations\\/([a-zA-Z0-9]{10,})/);
        if (conversationMatch && !isInvalidId(conversationMatch[1])) {
            return conversationMatch[1];
        }
        
        // Method 2: Last segment of path (fallback)
        const segments = pathname.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && lastSegment.length >= 10 && !isInvalidId(lastSegment)) {
            return lastSegment;
        }
        
        // Method 3: Query params
        const url = new URL(window.location.href);
        const fromQuery = url.searchParams.get('contactId') || url.searchParams.get('contact_id');
        if (fromQuery && fromQuery.length >= 10 && !isInvalidId(fromQuery)) {
            return fromQuery;
        }
        
        return null;
    }

    function getLocationId() {
        const match = window.location.pathname.match(/location\\/([^\\/]+)/);
        return match ? match[1] : null;
    }

    function isInvalidId(value) {
        if (!value) return true;
        const v = value.trim().toLowerCase();
        const blocked = ['conversations', 'contacts', 'detail', 'inbox', 'chat', 'settings', 'location', 'undefined', 'null', 'manual-actions'];
        if (blocked.includes(v)) return true;
        if (value.length < 15 && /^[a-zA-Z]+$/.test(value)) return true;
        return false;
    }

    function isConversationPage() {
        return window.location.pathname.includes('/conversations/');
    }

    // =====================================================
    // SPA NAVIGATION DETECTION
    // =====================================================
    function setupNavigationObserver() {
        // 1. Intercept history.pushState and replaceState
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            handleUrlChange('pushState');
        };

        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            handleUrlChange('replaceState');
        };

        // 2. Listen for popstate (back/forward navigation)
        window.addEventListener('popstate', () => handleUrlChange('popstate'));

        // 3. MutationObserver on document title (backup detection)
        const titleObserver = new MutationObserver(() => {
            if (window.location.href !== state.lastUrl) {
                handleUrlChange('titleChange');
            }
        });
        
        const titleEl = document.querySelector('title');
        if (titleEl) {
            titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
        }

        // 4. Fallback interval check (safety net)
        setInterval(() => {
            if (window.location.href !== state.lastUrl) {
                handleUrlChange('interval');
            }
        }, 1000);

        log.success('Observadores de navegação SPA configurados');
    }

    async function handleUrlChange(source) {
        const newUrl = window.location.href;
        if (newUrl === state.lastUrl) return;
        
        state.lastUrl = newUrl;
        
        if (!isConversationPage()) {
            log.info(\`Não é página de conversa, ignorando\`);
            return;
        }

        const newContactId = getContactIdFromUrl();
        const newLocationId = getLocationId();

        if (!newLocationId) {
            log.warn('LocationId não encontrado na URL');
            return;
        }

        // Location changed - full reload
        if (newLocationId !== state.currentLocationId) {
            log.nav(\`Location alterado: \${state.currentLocationId?.slice(0,8) || 'null'} → \${newLocationId.slice(0,8)}\`);
            state.currentLocationId = newLocationId;
            state.currentContactId = newContactId;
            await loadInstances();
            return;
        }

        // Contact changed - fetch active instance
        if (newContactId && newContactId !== state.currentContactId) {
            log.nav(\`Contato alterado: \${state.currentContactId?.slice(0,8) || 'null'} → \${newContactId.slice(0,8)}\`, { source });
            state.currentContactId = newContactId;
            await fetchActiveInstance();
        }
    }

    // =====================================================
    // API CALLS
    // =====================================================
    async function loadInstances() {
        const locationId = state.currentLocationId || getLocationId();
        const contactId = state.currentContactId || getContactIdFromUrl();

        if (!locationId) {
            log.warn('Sem locationId, abortando loadInstances');
            return;
        }

        state.currentLocationId = locationId;
        state.currentContactId = contactId;

        try {
            let url = \`\${CONFIG.api_url}?locationId=\${locationId}\`;
            if (contactId) {
                url += \`&contactId=\${contactId}\`;
            }

            log.api('Carregando instâncias...', { locationId: locationId.slice(0,8), contactId: contactId?.slice(0,8) });

            const res = await fetch(url);
            const data = await res.json();

            if (data.instances) {
                state.instances = data.instances;
                
                const activeId = data.activeInstanceId || (data.instances[0]?.id || null);
                const activeName = state.instances.find(i => i.id === activeId)?.name || 'N/A';
                
                log.success(\`\${data.instances.length} instâncias carregadas, ativa: \${activeName}\`);
                
                updateDropdown(activeId);
            }
        } catch (e) {
            log.error('Erro ao carregar instâncias:', e.message);
        }
    }

    async function fetchActiveInstance() {
        const { currentLocationId: locationId, currentContactId: contactId } = state;

        if (!locationId || !contactId) {
            log.warn('Sem locationId ou contactId para buscar instância ativa');
            return;
        }

        try {
            // Apenas envia contactId - a edge function faz o lookup do telefone
            const url = \`\${CONFIG.api_url}?locationId=\${locationId}&contactId=\${contactId}\`;
            
            log.api('Buscando instância ativa...', { contactId: contactId.slice(0,8) });

            const res = await fetch(url);
            const data = await res.json();

            if (data.activeInstanceId) {
                const activeName = state.instances.find(i => i.id === data.activeInstanceId)?.name || 'Desconhecida';
                log.success(\`Instância ativa recuperada: \${activeName}\`);
                updateDropdown(data.activeInstanceId);
            } else {
                log.info('Nenhuma preferência encontrada, usando primeira instância');
                updateDropdown(state.instances[0]?.id || null);
            }
        } catch (e) {
            log.error('Erro ao buscar instância ativa:', e.message);
        }
    }

    async function savePreference(instanceId) {
        const { currentLocationId: locationId, currentContactId: contactId } = state;

        if (!instanceId || !locationId || !contactId) {
            log.warn('Dados insuficientes para salvar preferência', { instanceId: !!instanceId, locationId: !!locationId, contactId: !!contactId });
            return;
        }

        try {
            const payload = { instanceId, locationId, contactId };
            
            await fetch(CONFIG.save_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const instanceName = state.instances.find(i => i.id === instanceId)?.name || 'Desconhecida';
            log.success(\`Preferência salva: \${instanceName}\`);
            showNotification(instanceName);
        } catch (e) {
            log.error('Erro ao salvar preferência:', e.message);
        }
    }

    // =====================================================
    // UI MANAGEMENT
    // =====================================================
    function updateDropdown(activeId) {
        const select = document.getElementById('bridge-instance-selector');
        if (!select || !state.instances.length) return;

        select.innerHTML = state.instances.map(i => 
            \`<option value="\${i.id}" \${i.id === activeId ? 'selected' : ''}>\${i.name}</option>\`
        ).join('');
    }

    function showPhoneNumbers(select) {
        if (!state.instances.length) return;
        const currentValue = select.value;
        
        select.innerHTML = state.instances.map(i => {
            const label = i.phone ? \`\${i.name} (\${i.phone})\` : i.name;
            return \`<option value="\${i.id}" \${i.id === currentValue ? 'selected' : ''}>\${label}</option>\`;
        }).join('');
    }

    function hidePhoneNumbers(select) {
        updateDropdown(select.value);
    }

    function showNotification(instanceName) {
        const existingToast = document.getElementById('bridge-notify');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.id = 'bridge-notify';
        toast.style.cssText = \`
            position: fixed; 
            bottom: 20px; 
            right: 20px; 
            z-index: 10000; 
            background: #1f2937; 
            color: white; 
            padding: 12px 20px; 
            border-radius: 8px; 
            font-size: 13px; 
            font-weight: 600; 
            border-left: 4px solid \${CONFIG.theme.primary};
            transition: opacity 0.3s;
        \`;
        toast.innerHTML = \`✅ Instância <b>\${instanceName}</b> selecionada.\`;
        document.body.appendChild(toast);
        
        setTimeout(() => { 
            toast.style.opacity = '0'; 
            setTimeout(() => toast.remove(), 300); 
        }, 3000);
    }

    // =====================================================
    // ROBUST INJECTION (with continuous retry)
    // =====================================================
    function createDropdownElement() {
        const wrapper = document.createElement('div');
        wrapper.id = 'bridge-api-container';
        wrapper.style.cssText = \`
            display: inline-flex; 
            align-items: center; 
            margin-left: 8px; 
            padding: 2px 10px; 
            height: 30px; 
            background: #ffffff; 
            border: 1px solid \${CONFIG.theme.border}; 
            border-radius: 20px;
        \`;
        wrapper.innerHTML = \`
            <div style="display:flex; align-items:center; gap:6px;">
                <div style="width: 8px; height: 8px; background: \${CONFIG.theme.primary}; border-radius: 50%;"></div>
                <select id="bridge-instance-selector"></select>
            </div>\`;

        return wrapper;
    }

    function injectDropdown() {
        // Already injected?
        if (document.getElementById('bridge-api-container')) {
            return true;
        }

        try {
            // Try multiple possible action bar selectors
            const actionBar = 
                document.querySelector('.msg-composer-actions') || 
                document.querySelector('.flex.flex-row.gap-2.items-center.pl-2') ||
                document.querySelector('[data-testid="message-actions"]') ||
                document.querySelector('.hl_conversations--composer-actions');

            if (!actionBar) {
                return false;
            }

            const wrapper = createDropdownElement();
            actionBar.appendChild(wrapper);

            const select = wrapper.querySelector('#bridge-instance-selector');
            
            // Event listeners
            select.addEventListener('mousedown', () => showPhoneNumbers(select));
            select.addEventListener('blur', () => hidePhoneNumbers(select));
            select.addEventListener('change', (e) => {
                savePreference(e.target.value);
                hidePhoneNumbers(select);
            });

            // Populate if we have data
            if (state.instances.length) {
                updateDropdown(state.instances[0]?.id);
            }

            state.isInjected = true;
            log.success('Dropdown injetado com sucesso');
            return true;

        } catch (e) {
            log.error('Erro ao injetar dropdown:', e.message);
            return false;
        }
    }

    function setupRobustInjection() {
        // Initial injection attempt
        injectDropdown();

        // MutationObserver for re-injection when GHL removes our element
        const observer = new MutationObserver((mutations) => {
            // Check if our container was removed
            if (!document.getElementById('bridge-api-container')) {
                if (state.isInjected) {
                    log.warn('Dropdown removido pelo GHL, reinjetando...');
                    state.isInjected = false;
                }
                
                // Try to reinject with a small delay
                setTimeout(() => {
                    if (!document.getElementById('bridge-api-container')) {
                        injectDropdown();
                    }
                }, CONFIG.reinject_delay);
            }
        });

        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });

        // Fallback interval for injection (safety net)
        setInterval(() => {
            if (!document.getElementById('bridge-api-container') && isConversationPage()) {
                injectDropdown();
            }
        }, 500);
    }

    // =====================================================
    // BACKGROUND SYNC
    // =====================================================
    function setupBackgroundSync() {
        setInterval(async () => {
            if (!isConversationPage()) return;
            
            const currentContactId = getContactIdFromUrl();
            
            // If contact changed without triggering our observers
            if (currentContactId && currentContactId !== state.currentContactId) {
                log.nav(\`Sync detectou mudança de contato: \${currentContactId.slice(0,8)}\`);
                state.currentContactId = currentContactId;
                await fetchActiveInstance();
            }
        }, CONFIG.sync_interval);
    }

    // =====================================================
    // INITIALIZATION
    // =====================================================
    function init() {
        // Wait for DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Initialize state
        state.currentLocationId = getLocationId();
        state.currentContactId = getContactIdFromUrl();
        state.lastUrl = window.location.href;

        log.info(\`Inicializando...\`, { 
            location: state.currentLocationId?.slice(0,8), 
            contact: state.currentContactId?.slice(0,8) 
        });

        // Setup systems
        setupNavigationObserver();
        setupRobustInjection();
        setupBackgroundSync();

        // Initial load
        if (state.currentLocationId) {
            loadInstances();
        }
    }

    // Start
    init();
})();`;

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
