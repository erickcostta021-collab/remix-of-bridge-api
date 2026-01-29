const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: Script carregado com sucesso v6.1.1
console.log('🚀 BRIDGE LOADER: Script carregado com sucesso v6.1.1');

try {
(function() {
    const VERSION = "6.1.1";
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
        info: (msg, data) => console.log(\`\${LOG_PREFIX} ℹ️ \${msg}\`, data !== undefined ? data : ''),
        success: (msg, data) => console.log(\`\${LOG_PREFIX} ✅ \${msg}\`, data !== undefined ? data : ''),
        warn: (msg, data) => console.warn(\`\${LOG_PREFIX} ⚠️ \${msg}\`, data !== undefined ? data : ''),
        error: (msg, data) => console.error(\`\${LOG_PREFIX} ❌ \${msg}\`, data !== undefined ? data : ''),
        nav: (msg, data) => console.log(\`\${LOG_PREFIX} 🔄 \${msg}\`, data !== undefined ? data : ''),
        api: (msg, data) => console.log(\`\${LOG_PREFIX} 📡 \${msg}\`, data !== undefined ? data : '')
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
    // STYLES (Vanilla JS - no external dependencies)
    // =====================================================
    function injectStyles() {
        try {
            const existingStyle = document.getElementById('bridge-styles');
            if (existingStyle) return;
            
            const style = document.createElement('style');
            style.id = 'bridge-styles';
            style.textContent = \`
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
            log.success('Estilos injetados');
        } catch (e) {
            log.error('Erro ao injetar estilos:', e.message);
        }
    }

    // =====================================================
    // URL & NAVIGATION HELPERS
    // =====================================================
    function getContactIdFromUrl() {
        try {
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
        } catch (e) {
            log.error('Erro ao extrair contactId:', e.message);
            return null;
        }
    }

    function getLocationId() {
        try {
            const match = window.location.pathname.match(/location\\/([^\\/]+)/);
            return match ? match[1] : null;
        } catch (e) {
            log.error('Erro ao extrair locationId:', e.message);
            return null;
        }
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
        try {
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
            const titleEl = document.querySelector('title');
            if (titleEl) {
                const titleObserver = new MutationObserver(() => {
                    if (window.location.href !== state.lastUrl) {
                        handleUrlChange('titleChange');
                    }
                });
                titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
            }

            // 4. Fallback interval check (safety net)
            setInterval(() => {
                if (window.location.href !== state.lastUrl) {
                    handleUrlChange('interval');
                }
            }, 1000);

            log.success('Observadores de navegação SPA configurados');
        } catch (e) {
            log.error('Erro ao configurar observadores de navegação:', e.message);
        }
    }

    async function handleUrlChange(source) {
        try {
            const newUrl = window.location.href;
            if (newUrl === state.lastUrl) return;
            
            state.lastUrl = newUrl;
            
            if (!isConversationPage()) {
                log.info('Não é página de conversa, ignorando');
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
                log.nav(\`Location alterado: \${state.currentLocationId ? state.currentLocationId.slice(0,8) : 'null'} → \${newLocationId.slice(0,8)}\`);
                state.currentLocationId = newLocationId;
                state.currentContactId = newContactId;
                await loadInstances();
                return;
            }

            // Contact changed - fetch active instance
            if (newContactId && newContactId !== state.currentContactId) {
                log.nav(\`Contato alterado: \${state.currentContactId ? state.currentContactId.slice(0,8) : 'null'} → \${newContactId.slice(0,8)}\`, { source: source });
                state.currentContactId = newContactId;
                await fetchActiveInstance();
            }
        } catch (e) {
            log.error('Erro ao processar mudança de URL:', e.message);
        }
    }

    // =====================================================
    // API CALLS (Vanilla fetch - no external libs)
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

            log.api('Carregando instâncias...', { locationId: locationId.slice(0,8), contactId: contactId ? contactId.slice(0,8) : null });

            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!res.ok) {
                throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
            }
            
            const data = await res.json();

            // FALLBACK: Se não houver instâncias, usa array vazio mas não esconde o dropdown
            if (data.instances && data.instances.length > 0) {
                state.instances = data.instances;
                
                const activeId = data.activeInstanceId || (data.instances[0] ? data.instances[0].id : null);
                const activeName = state.instances.find(function(i) { return i.id === activeId; });
                const activeNameStr = activeName ? activeName.name : 'N/A';
                
                log.success(\`\${data.instances.length} instâncias carregadas, ativa: \${activeNameStr}\`);
                
                updateDropdown(activeId);
            } else {
                log.warn('Nenhuma instância encontrada, mantendo dropdown com estado anterior');
                // Mantém dropdown visível mesmo sem instâncias
                if (state.instances.length === 0) {
                    state.instances = [{ id: 'none', name: 'Sem instâncias', phone: null }];
                    updateDropdown('none');
                }
            }
        } catch (e) {
            log.error('Erro ao carregar instâncias:', e.message);
            // FALLBACK: Em caso de erro, mantém o dropdown com uma opção padrão
            if (state.instances.length === 0) {
                state.instances = [{ id: 'error', name: 'Erro ao carregar', phone: null }];
                updateDropdown('error');
            }
        }
    }

    async function fetchActiveInstance() {
        const locationId = state.currentLocationId;
        const contactId = state.currentContactId;

        if (!locationId || !contactId) {
            log.warn('Sem locationId ou contactId para buscar instância ativa');
            return;
        }

        try {
            const url = \`\${CONFIG.api_url}?locationId=\${locationId}&contactId=\${contactId}\`;
            
            log.api('Buscando instância ativa...', { contactId: contactId.slice(0,8) });

            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!res.ok) {
                throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
            }
            
            const data = await res.json();

            if (data.activeInstanceId) {
                const activeName = state.instances.find(function(i) { return i.id === data.activeInstanceId; });
                const activeNameStr = activeName ? activeName.name : 'Desconhecida';
                log.success(\`Instância ativa recuperada: \${activeNameStr}\`);
                updateDropdown(data.activeInstanceId);
            } else {
                log.info('Nenhuma preferência encontrada, usando primeira instância');
                const firstInstance = state.instances[0];
                updateDropdown(firstInstance ? firstInstance.id : null);
            }
        } catch (e) {
            log.error('Erro ao buscar instância ativa:', e.message);
        }
    }

    async function savePreference(instanceId) {
        const locationId = state.currentLocationId;
        const contactId = state.currentContactId;

        if (!instanceId || !locationId || !contactId) {
            log.warn('Dados insuficientes para salvar preferência', { instanceId: !!instanceId, locationId: !!locationId, contactId: !!contactId });
            return;
        }
        
        // Ignora IDs especiais
        if (instanceId === 'none' || instanceId === 'error') {
            return;
        }

        try {
            const payload = { instanceId: instanceId, locationId: locationId, contactId: contactId };
            
            const res = await fetch(CONFIG.save_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
            }
            
            const instanceObj = state.instances.find(function(i) { return i.id === instanceId; });
            const instanceName = instanceObj ? instanceObj.name : 'Desconhecida';
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
        try {
            const select = document.getElementById('bridge-instance-selector');
            if (!select || !state.instances.length) return;

            select.innerHTML = state.instances.map(function(i) {
                return '<option value="' + i.id + '"' + (i.id === activeId ? ' selected' : '') + '>' + i.name + '</option>';
            }).join('');
        } catch (e) {
            log.error('Erro ao atualizar dropdown:', e.message);
        }
    }

    function showPhoneNumbers(select) {
        try {
            if (!state.instances.length) return;
            const currentValue = select.value;
            
            select.innerHTML = state.instances.map(function(i) {
                const label = i.phone ? i.name + ' (' + i.phone + ')' : i.name;
                return '<option value="' + i.id + '"' + (i.id === currentValue ? ' selected' : '') + '>' + label + '</option>';
            }).join('');
        } catch (e) {
            log.error('Erro ao mostrar telefones:', e.message);
        }
    }

    function hidePhoneNumbers(select) {
        updateDropdown(select.value);
    }

    function showNotification(instanceName) {
        try {
            const existingToast = document.getElementById('bridge-notify');
            if (existingToast) existingToast.remove();
            
            const toast = document.createElement('div');
            toast.id = 'bridge-notify';
            toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: #1f2937; color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; border-left: 4px solid ' + CONFIG.theme.primary + '; transition: opacity 0.3s;';
            toast.innerHTML = '✅ Instância <b>' + instanceName + '</b> selecionada.';
            document.body.appendChild(toast);
            
            setTimeout(function() { 
                toast.style.opacity = '0'; 
                setTimeout(function() { toast.remove(); }, 300); 
            }, 3000);
        } catch (e) {
            log.error('Erro ao mostrar notificação:', e.message);
        }
    }

    // =====================================================
    // ROBUST INJECTION (with continuous retry)
    // =====================================================
    function createDropdownElement() {
        const wrapper = document.createElement('div');
        wrapper.id = 'bridge-api-container';
        wrapper.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; padding: 2px 10px; height: 30px; background: #ffffff; border: 1px solid ' + CONFIG.theme.border + '; border-radius: 20px;';
        
        const innerDiv = document.createElement('div');
        innerDiv.style.cssText = 'display: flex; align-items: center; gap: 6px;';
        
        const dot = document.createElement('div');
        dot.style.cssText = 'width: 8px; height: 8px; background: ' + CONFIG.theme.primary + '; border-radius: 50%;';
        
        const select = document.createElement('select');
        select.id = 'bridge-instance-selector';
        
        innerDiv.appendChild(dot);
        innerDiv.appendChild(select);
        wrapper.appendChild(innerDiv);

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
            select.addEventListener('mousedown', function() { showPhoneNumbers(select); });
            select.addEventListener('blur', function() { hidePhoneNumbers(select); });
            select.addEventListener('change', function(e) {
                savePreference(e.target.value);
                hidePhoneNumbers(select);
            });

            // Populate if we have data
            if (state.instances.length) {
                const firstInstance = state.instances[0];
                updateDropdown(firstInstance ? firstInstance.id : null);
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
        try {
            // Initial injection attempt
            injectDropdown();

            // MutationObserver for re-injection when GHL removes our element
            const observer = new MutationObserver(function(mutations) {
                // Check if our container was removed
                if (!document.getElementById('bridge-api-container')) {
                    if (state.isInjected) {
                        log.warn('Dropdown removido pelo GHL, reinjetando...');
                        state.isInjected = false;
                    }
                    
                    // Try to reinject with a small delay
                    setTimeout(function() {
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
            setInterval(function() {
                if (!document.getElementById('bridge-api-container') && isConversationPage()) {
                    injectDropdown();
                }
            }, 500);
            
            log.success('Sistema de injeção robusto configurado');
        } catch (e) {
            log.error('Erro ao configurar injeção robusta:', e.message);
        }
    }

    // =====================================================
    // BACKGROUND SYNC
    // =====================================================
    function setupBackgroundSync() {
        try {
            setInterval(async function() {
                if (!isConversationPage()) return;
                
                const currentContactId = getContactIdFromUrl();
                
                // If contact changed without triggering our observers
                if (currentContactId && currentContactId !== state.currentContactId) {
                    log.nav('Sync detectou mudança de contato: ' + currentContactId.slice(0,8));
                    state.currentContactId = currentContactId;
                    await fetchActiveInstance();
                }
            }, CONFIG.sync_interval);
            
            log.success('Background sync configurado');
        } catch (e) {
            log.error('Erro ao configurar background sync:', e.message);
        }
    }

    // =====================================================
    // INITIALIZATION
    // =====================================================
    function init() {
        try {
            // Wait for DOM ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
                return;
            }

            // Inject styles first
            injectStyles();

            // Initialize state
            state.currentLocationId = getLocationId();
            state.currentContactId = getContactIdFromUrl();
            state.lastUrl = window.location.href;

            log.info('Inicializando...', { 
                location: state.currentLocationId ? state.currentLocationId.slice(0,8) : null, 
                contact: state.currentContactId ? state.currentContactId.slice(0,8) : null
            });

            // Setup systems
            setupNavigationObserver();
            setupRobustInjection();
            setupBackgroundSync();

            // Initial load
            if (state.currentLocationId) {
                loadInstances();
            }
            
            log.success('Inicialização concluída v' + VERSION);
        } catch (e) {
            log.error('Erro durante inicialização:', e.message);
        }
    }

    // Start
    init();
})();
} catch (e) {
    console.error('[Bridge] ❌ Erro de Inicialização:', e);
}
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