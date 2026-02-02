const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const BRIDGE_SWITCHER_SCRIPT = `
// 🚀 BRIDGE LOADER: v6.8.6 - Posicionamento Universal
console.log('🚀 BRIDGE LOADER: v6.8.6 Iniciado');

try {
    (function() {
        const LOG_PREFIX = "[Bridge]";
        const CONFIG = {
            api_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/get-instances',
            save_url: 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/bridge-switcher',
            sync_interval: 2000
        };
        let state = { instances: [], lastPhoneFound: null };

        function extractPhoneFromGHL() {
            const phoneEl = document.querySelector('[data-testid="contact-phone"]') || 
                            document.querySelector('a[href^="tel:"]') ||
                            document.querySelector('.contact-details a');
            if (!phoneEl) return null;
            const clean = (phoneEl.textContent || phoneEl.getAttribute('href') || "").replace(/\\D/g, '');
            return clean.length >= 10 ? (clean.length === 11 && !clean.startsWith('55') ? '55' + clean : clean) : null;
        }

        async function savePreference(instanceId) {
            const phone = extractPhoneFromGHL();
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            if (!phone || !locId) return alert("Telefone não detectado.");
            const res = await fetch(CONFIG.save_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId, locationId: locId, phone })
            });
            if (res.ok) {
                document.getElementById('bridge-api-container').style.background = '#dcfce7';
                setTimeout(() => document.getElementById('bridge-api-container').style.background = '#fff', 1500);
            }
        }

        async function loadInstances(select) {
            const locId = window.location.pathname.match(/location\\/([^\\/]+)/)?.[1];
            if (!locId) return;
            const res = await fetch(CONFIG.api_url + '?locationId=' + locId);
            const data = await res.json();
            if (data.instances) {
                state.instances = data.instances;
                select.innerHTML = data.instances.map(i => \`<option value="\${i.id}">\${i.name}</option>\`).join('');
            }
        }

        function inject() {
            if (document.getElementById('bridge-api-container')) return;
            
            // Novos seletores de 2026 para o GHL V2
            const target = document.querySelector('.msg-composer-actions') || 
                           document.querySelector('#message-input-container') ||
                           document.querySelector('.relative.flex-1.flex.flex-col') || // Container da conversa
                           document.querySelector('section#conversations');
            if (!target) return;

            const container = document.createElement('div');
            container.id = 'bridge-api-container';
            container.style.cssText = 'display: inline-flex; align-items: center; margin: 5px; padding: 5px 12px; background: #fff; border: 2px solid #6366f1; border-radius: 50px; z-index: 9999; box-shadow: 0 2px 5px rgba(0,0,0,0.1);';
            container.innerHTML = \`<span style="font-size:10px; font-weight:bold; color:#6366f1; margin-right:5px;">BRIDGE:</span>
                                   <select id="bridge-instance-selector" style="border:none; background:transparent; font-size:12px; font-weight:bold; outline:none; color:#374151;"></select>\`;
            
            // Se for o container da conversa, coloca no topo, se for a barra de msg, coloca dentro
            target.prepend(container); 
            
            const select = container.querySelector('select');
            select.addEventListener('change', (e) => savePreference(e.target.value));
            loadInstances(select);
        }

        setInterval(() => {
            if (window.location.pathname.includes('/conversations')) {
                inject();
                const phone = extractPhoneFromGHL();
                if (phone && phone !== state.lastPhoneFound) {
                    state.lastPhoneFound = phone;
                    console.log("[Bridge] Lead focado: " + phone);
                }
            }
        }, 2000);
    })();
} catch (e) {}
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
