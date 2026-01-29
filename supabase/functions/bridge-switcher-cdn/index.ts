const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: Script carregado com sucesso v6.4.0
console.log('🚀 BRIDGE LOADER: Script carregado com sucesso v6.4.0');

try {
(function() {
    const VERSION = "6.4.0";
    const LOG_PREFIX = "[Bridge]";
    
    const CONFIG = {
        api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
        save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
        reinject_interval: 200,    // Intervalo para verificar/reinjetar dropdown
        sync_interval: 1500,       // Sync background mais frequente (era 2000ms)
        sync_lock_duration: 100,   // Trava de sincronização
        value_check_delay: 500,    // Delay para validar valor após DOM estabilizar
        message_debounce: 800,     // Debounce para detectar novas mensagens
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
        api: (msg, data) => console.log(\`\${LOG_PREFIX} 📡 \${msg}\`, data !== undefined ? data : ''),
        compare: (msg, data) => console.log(\`\${LOG_PREFIX} 🔍 \${msg}\`, data !== undefined ? data : '')
    };

    log.info(\`Switcher v\${VERSION} - Inbound Reactivity\`);

    // =====================================================
    // STATE MANAGEMENT
    // =====================================================
    let state = {
        instances: [],
        currentContactId: null,
        currentLocationId: null,
        lastUrl: window.location.href,
        isInjected: false,
        isSyncingDropdown: false,      // Flag para evitar loop ao sincronizar visualmente
        syncLockUntil: 0,              // Timestamp até quando ignorar novas ordens de sync
        pendingSyncId: null,           // ID pendente para sincronizar após lock
        lastKnownActiveId: null        // Última instância ativa conhecida do banco (SEMPRE ID, nunca nome)
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

            if (data.instances && data.instances.length > 0) {
                state.instances = data.instances;
                
                const activeId = data.activeInstanceId || (data.instances[0] ? data.instances[0].id : null);
                state.lastKnownActiveId = activeId;
                
                const activeName = state.instances.find(function(i) { return i.id === activeId; });
                const activeNameStr = activeName ? activeName.name : 'N/A';
                
                log.success(\`\${data.instances.length} instâncias carregadas, ativa: \${activeNameStr}\`);
                
                requestDropdownSync(activeId);
            } else {
                log.warn('Nenhuma instância encontrada, mantendo dropdown com estado anterior');
                if (state.instances.length === 0) {
                    state.instances = [{ id: 'none', name: 'Sem instâncias', phone: null }];
                    requestDropdownSync('none');
                }
            }
        } catch (e) {
            log.error('Erro ao carregar instâncias:', e.message);
            if (state.instances.length === 0) {
                state.instances = [{ id: 'error', name: 'Erro ao carregar', phone: null }];
                requestDropdownSync('error');
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
                state.lastKnownActiveId = data.activeInstanceId;
                const activeName = state.instances.find(function(i) { return i.id === data.activeInstanceId; });
                const activeNameStr = activeName ? activeName.name : 'Desconhecida';
                log.success(\`Instância ativa recuperada: \${activeNameStr}\`);
                requestDropdownSync(data.activeInstanceId);
            } else {
                log.info('Nenhuma preferência encontrada, usando primeira instância');
                const firstInstance = state.instances[0];
                const fallbackId = firstInstance ? firstInstance.id : null;
                state.lastKnownActiveId = fallbackId;
                requestDropdownSync(fallbackId);
            }
        } catch (e) {
            log.error('Erro ao buscar instância ativa:', e.message);
        }
    }

    // =====================================================
    // SALVAMENTO MANUAL (usuário clicou no dropdown)
    // =====================================================
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
            log.info(\`💾 Salvando preferência manual: \${instanceId.slice(0,8)}\`);
            
            const payload = { instanceId: instanceId, locationId: locationId, contactId: contactId };
            
            const res = await fetch(CONFIG.save_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
            }
            
            // Atualiza o estado local para evitar re-sincronização
            state.lastKnownActiveId = instanceId;
            
            const instanceObj = state.instances.find(function(i) { return i.id === instanceId; });
            const instanceName = instanceObj ? instanceObj.name : 'Desconhecida';
            log.success(\`Preferência salva: \${instanceName}\`);
            showNotification(instanceName);
        } catch (e) {
            log.error('Erro ao salvar preferência:', e.message);
        }
    }

    // =====================================================
    // SINCRONIZAÇÃO VISUAL COM TRAVA (evita múltiplas ordens simultâneas)
    // =====================================================
    function requestDropdownSync(activeId, isExternalUpdate = false) {
        if (!activeId) return;
        
        const now = Date.now();
        
        // PRIORIDADE: Mudanças externas (inbound) ignoram o lock
        if (now < state.syncLockUntil && !isExternalUpdate) {
            log.info(\`🔒 Sync ignorado (lock ativo por mais \${state.syncLockUntil - now}ms), pendente: \${activeId.slice(0,8)}\`);
            state.pendingSyncId = activeId;
            return;
        }
        
        // Ativa trava (mais curta agora - 100ms)
        state.syncLockUntil = now + CONFIG.sync_lock_duration;
        state.pendingSyncId = null;
        
        const instanceName = state.instances.find(function(i) { return i.id === activeId; });
        const nameStr = instanceName ? instanceName.name : activeId.slice(0,8);
        
        if (isExternalUpdate) {
            log.info(\`📥 Atualização detectada via Webhook! Mudando para: \${nameStr}\`);
        } else {
            log.info(\`🎯 Tentando definir dropdown para: \${nameStr}\`);
        }
        
        // Ativa flag de sincronização
        state.isSyncingDropdown = true;
        
        // Delay de 300ms para garantir que o GHL terminou de renderizar
        setTimeout(function() {
            executeDropdownSync(activeId, 0);
        }, 300);
    }

    function executeDropdownSync(activeId, attempt) {
        const MAX_ATTEMPTS = 3;
        const RETRY_DELAY = 200;

        try {
            const select = document.getElementById('bridge-instance-selector');
            
            if (!select) {
                log.warn(\`Dropdown não encontrado (tentativa \${attempt + 1}/\${MAX_ATTEMPTS})\`);
                if (attempt < MAX_ATTEMPTS - 1) {
                    setTimeout(function() {
                        executeDropdownSync(activeId, attempt + 1);
                    }, RETRY_DELAY);
                } else {
                    finishSync();
                }
                return;
            }

            if (!state.instances.length) {
                log.warn('Sem instâncias para popular dropdown');
                finishSync();
                return;
            }

            // Popula as opções primeiro
            select.innerHTML = state.instances.map(function(i) {
                return '<option value="' + i.id + '">' + i.name + '</option>';
            }).join('');

            // Verifica se a opção com o activeId existe
            const optionExists = Array.from(select.options).some(function(opt) {
                return opt.value === activeId;
            });

            if (!optionExists) {
                log.warn(\`Opção \${activeId.slice(0,8)} não existe no dropdown (tentativa \${attempt + 1}/\${MAX_ATTEMPTS})\`);
                if (attempt < MAX_ATTEMPTS - 1) {
                    setTimeout(function() {
                        executeDropdownSync(activeId, attempt + 1);
                    }, RETRY_DELAY);
                } else {
                    finishSync();
                }
                return;
            }

            // Define o valor diretamente (sem dispatchEvent para evitar loop)
            select.value = activeId;

            // Verifica se o valor foi realmente definido
            if (select.value === activeId) {
                log.success(\`✅ Dropdown sincronizado para: \${activeId.slice(0,8)}\`);
            } else {
                log.warn(\`⚠️ Dropdown não sincronizou. Esperado: \${activeId.slice(0,8)}, Atual: \${select.value.slice(0,8)}\`);
                
                if (attempt < MAX_ATTEMPTS - 1) {
                    setTimeout(function() {
                        executeDropdownSync(activeId, attempt + 1);
                    }, RETRY_DELAY);
                    return;
                }
            }
            
            finishSync();
            
        } catch (e) {
            log.error(\`Erro ao definir valor do dropdown (tentativa \${attempt + 1}): \${e.message}\`);
            if (attempt < MAX_ATTEMPTS - 1) {
                setTimeout(function() {
                    executeDropdownSync(activeId, attempt + 1);
                }, RETRY_DELAY);
            } else {
                finishSync();
            }
        }
    }

    function finishSync() {
        state.isSyncingDropdown = false;
        
        // Se há um ID pendente, processa após o lock expirar
        if (state.pendingSyncId) {
            const pendingId = state.pendingSyncId;
            state.pendingSyncId = null;
            setTimeout(function() {
                requestDropdownSync(pendingId);
            }, 100);
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
        try {
            if (!state.instances.length) return;
            const currentValue = select.value;
            
            select.innerHTML = state.instances.map(function(i) {
                return '<option value="' + i.id + '"' + (i.id === currentValue ? ' selected' : '') + '>' + i.name + '</option>';
            }).join('');
        } catch (e) {
            log.error('Erro ao esconder telefones:', e.message);
        }
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
    // ROBUST INJECTION (with continuous interval check)
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

    function findActionBar() {
        // Tenta múltiplos seletores em ordem de prioridade
        const selectors = [
            '.msg-composer-actions',
            '.flex.flex-row.gap-2.items-center.pl-2',
            '[data-testid="message-actions"]',
            '.hl_conversations--composer-actions',
            // Fallbacks alternativos
            '.ghl-footer',
            '.item-contact-details',
            '.conversation-footer',
            '.message-input-container'
        ];
        
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
                return el;
            }
        }
        
        return null;
    }

    function injectDropdown() {
        // Already injected?
        const existingContainer = document.getElementById('bridge-api-container');
        if (existingContainer) {
            // SUAVIZADO: Não verifica valor aqui, deixa o setupPersistentInjection fazer com delay
            return true;
        }

        try {
            const actionBar = findActionBar();

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
                // CRÍTICO: Ignora se estamos sincronizando visualmente (evita loop)
                if (state.isSyncingDropdown) {
                    log.info('🔒 Change ignorado (sincronização visual em progresso)');
                    return;
                }
                
                // Usuário clicou manualmente - SALVAR!
                log.info(\`👆 Usuário selecionou manualmente: \${e.target.value.slice(0,8)}\`);
                savePreference(e.target.value);
                hidePhoneNumbers(select);
            });

            state.isInjected = true;
            log.success('Dropdown injetado com sucesso');

            // NOVO: Sincroniza IMEDIATAMENTE após injeção bem-sucedida
            if (state.instances.length && state.lastKnownActiveId) {
                log.info('Sincronizando dropdown pós-injeção');
                requestDropdownSync(state.lastKnownActiveId);
            } else if (state.instances.length) {
                const firstId = state.instances[0] ? state.instances[0].id : null;
                if (firstId) {
                    requestDropdownSync(firstId);
                }
            }

            return true;

        } catch (e) {
            log.error('Erro ao injetar dropdown:', e.message);
            return false;
        }
    }

    function setupPersistentInjection() {
        try {
            let lastValueCheckTime = 0;
            
            // NOVO: setInterval curto que verifica continuamente
            setInterval(function() {
                if (!isConversationPage()) return;
                
                const container = document.getElementById('bridge-api-container');
                
                if (!container) {
                    // Dropdown sumiu, reinjeta
                    if (state.isInjected) {
                        log.warn('Dropdown removido pelo GHL, reinjetando...');
                        state.isInjected = false;
                    }
                    injectDropdown();
                } else {
                    // SUAVIZADO: Só verifica valor após delay de 500ms desde última verificação
                    const now = Date.now();
                    if (now - lastValueCheckTime < CONFIG.value_check_delay) {
                        return; // Espera DOM estabilizar
                    }
                    
                    const select = container.querySelector('#bridge-instance-selector');
                    if (select && state.lastKnownActiveId && select.value !== state.lastKnownActiveId) {
                        if (!state.isSyncingDropdown) {
                            lastValueCheckTime = now;
                            log.info('Valor incorreto detectado após estabilização, corrigindo...');
                            requestDropdownSync(state.lastKnownActiveId);
                        }
                    }
                }
            }, CONFIG.reinject_interval);

            // Injeção inicial
            injectDropdown();
            
            log.success('Sistema de injeção persistente configurado');
        } catch (e) {
            log.error('Erro ao configurar injeção persistente:', e.message);
        }
    }

    // =====================================================
    // BACKGROUND SYNC (detecta mudanças no banco via inbound)
    // =====================================================
    function setupBackgroundSync() {
        try {
            // FORÇA PRIMEIRO TICK IMEDIATAMENTE (não espera o intervalo)
            log.info('🔄 Iniciando background sync...');
            
            const syncTick = async function() {
                try {
                    // Log de heartbeat para confirmar que o loop está rodando
                    const locationId = state.currentLocationId || getLocationId();
                    const contactId = state.currentContactId || getContactIdFromUrl();
                    
                    if (!isConversationPage()) {
                        return;
                    }
                    
                    // Se contato mudou, busca a instância ativa
                    if (contactId && contactId !== state.currentContactId) {
                        log.nav('Sync detectou mudança de contato: ' + contactId.slice(0,8));
                        state.currentContactId = contactId;
                        await fetchActiveInstance();
                        return;
                    }
                    
                    // Verifica se a instância ativa no banco mudou (inbound message)
                    if (locationId) {
                        state.currentLocationId = locationId;
                        await checkForInboundUpdates();
                    }
                } catch (e) {
                    log.error('Erro no tick de sync:', e.message);
                }
            };
            
            // EXECUTA PRIMEIRO TICK IMEDIATAMENTE
            setTimeout(syncTick, 500);
            
            // Continua executando a cada intervalo
            setInterval(syncTick, CONFIG.sync_interval);
            
            log.success('Background sync configurado (a cada ' + (CONFIG.sync_interval/1000) + 's)');
        } catch (e) {
            log.error('Erro ao configurar background sync:', e.message);
        }
    }

    // =====================================================
    // MESSAGE LISTENER - Detecta novas mensagens na UI
    // =====================================================
    function setupMessageListener() {
        try {
            let messageDebounceTimer = null;
            
            // Observer para detectar novas mensagens na lista de conversa
            const messageObserver = new MutationObserver(function(mutations) {
                // Verifica se houve adição de novos elementos de mensagem
                let hasNewMessage = false;
                
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1) { // Element node
                                // Detecta padrões comuns de mensagens no GHL
                                const isMessage = node.classList && (
                                    node.classList.contains('message') ||
                                    node.classList.contains('conversation-message') ||
                                    node.classList.contains('hl_conversations--message') ||
                                    node.querySelector && node.querySelector('[data-message-id]')
                                );
                                
                                // Também detecta containers de mensagens
                                const isMessageContainer = node.querySelector && (
                                    node.querySelector('.message') ||
                                    node.querySelector('[data-message-id]')
                                );
                                
                                if (isMessage || isMessageContainer) {
                                    hasNewMessage = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (hasNewMessage) break;
                }
                
                if (hasNewMessage) {
                    // Debounce para evitar múltiplas chamadas
                    if (messageDebounceTimer) {
                        clearTimeout(messageDebounceTimer);
                    }
                    
                    messageDebounceTimer = setTimeout(async function() {
                        log.info('📩 Nova mensagem detectada na UI! Verificando preferência...');
                        await checkForInboundUpdates();
                    }, CONFIG.message_debounce);
                }
            });
            
            // Função para encontrar e observar o container de mensagens
            function observeMessageContainer() {
                // Seletores comuns do container de mensagens no GHL
                const containerSelectors = [
                    '.conversation-messages',
                    '.messages-container',
                    '.hl_conversations--messages',
                    '[data-testid="conversation-messages"]',
                    '.conversation-view',
                    '#conversation-messages'
                ];
                
                for (const selector of containerSelectors) {
                    const container = document.querySelector(selector);
                    if (container) {
                        messageObserver.observe(container, { 
                            childList: true, 
                            subtree: true 
                        });
                        log.success('Message listener ativo em: ' + selector);
                        return true;
                    }
                }
                
                // Fallback: observa o body inteiro (menos eficiente, mas funciona)
                const conversationArea = document.querySelector('.conversation-wrapper') || 
                                         document.querySelector('.hl_conversations') ||
                                         document.querySelector('main');
                if (conversationArea) {
                    messageObserver.observe(conversationArea, { 
                        childList: true, 
                        subtree: true 
                    });
                    log.info('Message listener ativo em fallback container');
                    return true;
                }
                
                return false;
            }
            
            // Tenta observar imediatamente e depois a cada 2s (caso DOM mude)
            if (!observeMessageContainer()) {
                const retryInterval = setInterval(function() {
                    if (observeMessageContainer()) {
                        clearInterval(retryInterval);
                    }
                }, 2000);
            }
            
            log.success('Sistema de detecção de mensagens configurado');
        } catch (e) {
            log.error('Erro ao configurar message listener:', e.message);
        }
    }

    // =====================================================
    // VERIFICAÇÃO DE ATUALIZAÇÕES INBOUND (REATIVIDADE)
    // =====================================================
    async function checkForInboundUpdates() {
        try {
            const locationId = state.currentLocationId;
            const contactId = state.currentContactId;
            
            // Permite verificar mesmo sem contactId (só precisa de locationId)
            if (!locationId) {
                log.compare('Sem locationId, aguardando...');
                return;
            }
            
            let url = \`\${CONFIG.api_url}?locationId=\${locationId}\`;
            if (contactId) {
                url += \`&contactId=\${contactId}\`;
            }
            
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store'  // Garante que não usa cache do navegador
            });
            
            if (!res.ok) {
                log.warn(\`Erro na API: HTTP \${res.status}\`);
                return;
            }
            
            const data = await res.json();
            const serverActiveId = data.activeInstanceId; // SEMPRE um UUID, nunca nome
            
            const select = document.getElementById('bridge-instance-selector');
            const currentDropdownValue = select ? select.value : null;
            
            // LOG DE COMPARAÇÃO - Com nomes para facilitar debug (SEMPRE LOGA)
            const currentDropdownName = state.instances.find(function(i) { return i.id === currentDropdownValue; });
            const serverActiveName = state.instances.find(function(i) { return i.id === serverActiveId; });
            log.compare(\`Comparando: Dropdown(\${currentDropdownName ? currentDropdownName.name : 'N/A'}) vs Banco(\${serverActiveName ? serverActiveName.name : 'N/A'})\`);
            
            if (!serverActiveId) {
                log.compare('Sem preferência no banco para este contato');
                return;
            }
            
            // FORÇA ATUALIZAÇÃO se dropdown difere do banco, IGNORANDO lastKnownActiveId
            // Isso garante reatividade imediata quando mensagem inbound muda a preferência
            if (serverActiveId !== currentDropdownValue) {
                log.info(\`📥 Diferença detectada! Atualizando dropdown...\`);
                state.lastKnownActiveId = serverActiveId;
                // Chama com flag de atualização externa para ignorar lock
                requestDropdownSync(serverActiveId, true);
            } else if (serverActiveId !== state.lastKnownActiveId) {
                // Atualiza estado interno mesmo se dropdown já está correto
                state.lastKnownActiveId = serverActiveId;
            }
        } catch (e) {
            log.error('Erro em checkForInboundUpdates:', e.message);
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
            setupPersistentInjection();
            setupBackgroundSync();
            setupMessageListener();  // NOVO: Detecta mensagens na UI

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