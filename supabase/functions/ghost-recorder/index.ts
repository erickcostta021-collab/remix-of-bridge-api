import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// =====================================================================
// POST HANDLER: Receive audio + context, send directly to UAZAPI
// =====================================================================

async function handleAudioSend(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { audio, locationId, phone, instanceId } = body;

    if (!audio || !locationId || !phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: audio, locationId, phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ghost-recorder] POST received:", { locationId, phone: phone.slice(0, 8) + "...", audioLength: audio.length, instanceId });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve instance
    let resolvedInstanceId = instanceId;

    if (!resolvedInstanceId) {
      // Try contact_instance_preferences
      const normalizedPhone = phone.replace(/\D/g, "");
      const last10 = normalizedPhone.slice(-10);
      
      const { data: pref } = await supabase
        .from("contact_instance_preferences")
        .select("instance_id")
        .eq("location_id", locationId)
        .or(`lead_phone.eq.${normalizedPhone},lead_phone.like.%${last10}%`)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (pref?.[0]) {
        resolvedInstanceId = pref[0].instance_id;
      }
    }

    if (!resolvedInstanceId) {
      // Fallback: first connected instance for this location's subaccount
      const { data: sub } = await supabase
        .from("ghl_subaccounts")
        .select("id")
        .eq("location_id", locationId)
        .not("ghl_access_token", "is", null)
        .limit(1);

      if (sub?.[0]) {
        const { data: inst } = await supabase
          .from("instances")
          .select("id")
          .eq("subaccount_id", sub[0].id)
          .eq("instance_status", "connected")
          .limit(1);
        
        if (inst?.[0]) resolvedInstanceId = inst[0].id;
      }
    }

    if (!resolvedInstanceId) {
      console.error("[ghost-recorder] No instance found for location:", locationId);
      return new Response(
        JSON.stringify({ error: "No instance found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get instance details
    const { data: instance } = await supabase
      .from("instances")
      .select("uazapi_base_url, uazapi_instance_token, instance_name")
      .eq("id", resolvedInstanceId)
      .single();

    if (!instance?.uazapi_base_url || !instance?.uazapi_instance_token) {
      console.error("[ghost-recorder] Instance missing UAZAPI config:", resolvedInstanceId);
      return new Response(
        JSON.stringify({ error: "Instance not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const base = instance.uazapi_base_url;
    const token = instance.uazapi_instance_token;
    const cleanPhone = phone.replace(/\D/g, "");

    console.log("[ghost-recorder] Sending audio via UAZAPI:", { 
      instance: instance.instance_name, 
      base, 
      phone: cleanPhone.slice(0, 8) + "..." 
    });

    // Try multiple UAZAPI endpoints/payload formats
    const dataUri = `data:audio/ogg;base64,${audio}`;
    
    const attempts = [
      // Attempt 1: /send/audio with audio field (base64)
      {
        path: "/send/audio",
        body: { number: cleanPhone, audio: dataUri, readchat: "true" },
      },
      // Attempt 2: /send/audio with file field (base64)
      {
        path: "/send/audio",
        body: { number: cleanPhone, file: dataUri, readchat: "true" },
      },
      // Attempt 3: /send/media with type myaudio
      {
        path: "/send/media",
        body: { number: cleanPhone, type: "myaudio", file: dataUri, readchat: "true" },
      },
      // Attempt 4: /send/media with type audio
      {
        path: "/send/media",
        body: { number: cleanPhone, type: "audio", file: dataUri, readchat: "true" },
      },
      // Attempt 5: /send/media without type
      {
        path: "/send/media",
        body: { number: cleanPhone, file: dataUri, readchat: "true" },
      },
    ];

    let lastStatus = 0;
    let lastBody = "";

    for (const attempt of attempts) {
      const url = `${base}${attempt.path}`;
      console.log("[ghost-recorder] Trying:", { url, bodyKeys: Object.keys(attempt.body) });

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", token },
          body: JSON.stringify(attempt.body),
        });

        lastStatus = res.status;
        lastBody = await res.text();
        console.log("[ghost-recorder] Response:", { url, status: lastStatus, body: lastBody.substring(0, 300) });

        if (res.ok) {
          let messageId = null;
          try {
            const parsed = JSON.parse(lastBody);
            messageId = parsed?.messageid || parsed?.messageId || parsed?.id || parsed?.key?.id || null;
          } catch { /* ignore */ }

          return new Response(
            JSON.stringify({ success: true, messageId, instance: instance.instance_name }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.error("[ghost-recorder] Fetch error:", e);
        lastBody = String(e);
      }
    }

    console.error("[ghost-recorder] All attempts failed:", { lastStatus, lastBody: lastBody.substring(0, 300) });
    return new Response(
      JSON.stringify({ error: "Failed to send audio", status: lastStatus, detail: lastBody.substring(0, 200) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("[ghost-recorder] POST handler error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// =====================================================================
// GHOST RECORDER SCRIPT (served via GET)
// =====================================================================

const GHOST_RECORDER_SCRIPT = `/**
 * DOUG.TECH - GHOST RECORDER v4
 * Direct UAZAPI audio send (bypasses GHL file input)
 */
(function() {
    console.log("DOUG.TECH: Ghost Recorder v4 carregado");

    var SEND_URL = 'https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/ghost-recorder';
    var mediaRecorder = null;
    var currentStream = null;
    var audioChunks = [];
    var audioBlob = null;
    var audioPlayer = null;
    var isRecording = false;
    var timerInterval;
    var startTime;
    var recordedMimeType = '';

    var ICONS = {
        mic: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-500 hover:text-gray-700"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>',
        stop: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-red-500 animate-pulse"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>',
        play: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-blue-600"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-blue-600"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-400 hover:text-red-500"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
        send: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-green-500 hover:text-green-600"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'
    };

    var container, mainBtn, actionGroup, timerDisplay;

    function getPreferredMimeType() {
        var candidates = [
            'audio/ogg;codecs=opus',
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/aac',
            'audio/mpeg'
        ];
        for (var i = 0; i < candidates.length; i++) {
            if (MediaRecorder.isTypeSupported(candidates[i])) {
                console.log("DOUG.TECH: Using mimeType:", candidates[i]);
                return candidates[i];
            }
        }
        return '';
    }

    function extractLocationId() {
        var match = window.location.pathname.match(/location\\/([^\\/]+)/);
        return match ? match[1] : null;
    }

    function extractPhone() {
        var input = document.querySelector('input.hr-input-phone');
        if (input && input.value) return cleanPhone(input.value);
        var activeCard = document.querySelector('[data-is-active="true"][phone]');
        if (activeCard) return cleanPhone(activeCard.getAttribute('phone'));
        return null;
    }

    function cleanPhone(raw) {
        if (!raw) return null;
        var clean = raw.replace(/\\D/g, '');
        if (clean.length === 11 && !clean.startsWith('55')) return '55' + clean;
        return clean.length >= 10 ? clean : null;
    }

    function getSelectedInstanceId() {
        var select = document.getElementById('bridge-instance-selector');
        return select ? select.value : null;
    }

    function createUI() {
        var toolbar = document.querySelector('.message-input-actions') || 
                      document.querySelector('.toolbar-container') ||
                      document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');

        if (toolbar && !document.getElementById('doug-maestro-ui')) {
            container = document.createElement('div');
            container.id = 'doug-maestro-ui';
            container.style.cssText = "display: flex; align-items: center; margin-right: 8px;";

            mainBtn = document.createElement('div');
            mainBtn.innerHTML = ICONS.mic;
            mainBtn.style.cssText = "cursor: pointer; padding: 6px; border-radius: 50%; transition: all 0.2s;";
            mainBtn.onclick = handleMainClick;

            timerDisplay = document.createElement('span');
            timerDisplay.innerText = "00:00";
            timerDisplay.style.cssText = "display: none; font-size: 13px; font-weight: 600; color: #ef4444; margin: 0 8px;";

            actionGroup = document.createElement('div');
            actionGroup.style.cssText = "display: none; align-items: center; gap: 5px; background: #f3f4f6; padding: 4px; border-radius: 20px;";
            
            var btnPlay = document.createElement('div'); btnPlay.innerHTML = ICONS.play; btnPlay.onclick = togglePreview; btnPlay.style.cursor='pointer'; btnPlay.style.padding='4px';
            var btnTrash = document.createElement('div'); btnTrash.innerHTML = ICONS.trash; btnTrash.onclick = fullReset; btnTrash.style.cursor='pointer'; btnTrash.style.padding='4px';
            var btnSend = document.createElement('div'); btnSend.innerHTML = ICONS.send; btnSend.onclick = handleSend; btnSend.style.cursor='pointer'; btnSend.style.padding='4px';
            
            actionGroup.appendChild(btnTrash); actionGroup.appendChild(btnPlay); actionGroup.appendChild(btnSend);
            container.appendChild(timerDisplay); container.appendChild(mainBtn); container.appendChild(actionGroup);
            toolbar.insertBefore(container, toolbar.firstChild);
        }
    }

    async function handleMainClick() {
        if (!isRecording) {
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                var preferredMime = getPreferredMimeType();
                var options = preferredMime ? { mimeType: preferredMime } : {};
                mediaRecorder = new MediaRecorder(currentStream, options);
                recordedMimeType = mediaRecorder.mimeType;
                console.log("DOUG.TECH: Recording with mimeType:", recordedMimeType);
                audioChunks = [];
                mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) audioChunks.push(e.data); };
                mediaRecorder.start();
                isRecording = true;
                mainBtn.innerHTML = ICONS.stop; timerDisplay.style.display = 'block'; startTimer();
            } catch (err) { alert("Microfone bloqueado."); fullReset(); }
        } else {
            if (mediaRecorder) mediaRecorder.stop();
            isRecording = false; stopTimer();
            if (currentStream) currentStream.getTracks().forEach(function(t) { t.stop(); });
            mediaRecorder.onstop = function() {
                audioBlob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
                console.log("DOUG.TECH: Audio blob ready, size:", audioBlob.size);
                var audioUrl = URL.createObjectURL(audioBlob);
                audioPlayer = new Audio(audioUrl);
                mainBtn.style.display = 'none'; timerDisplay.style.display = 'none'; actionGroup.style.display = 'flex';
            };
        }
    }

    async function handleSend() {
        if (!audioBlob) return;
        
        actionGroup.style.opacity = "0.5";
        actionGroup.style.pointerEvents = "none";

        var locationId = extractLocationId();
        var phone = extractPhone();
        var instanceId = getSelectedInstanceId();

        console.log("DOUG.TECH: Sending audio directly via edge function:", {
            locationId: locationId,
            phone: phone ? phone.slice(0, 8) + '...' : null,
            instanceId: instanceId,
            blobSize: audioBlob.size
        });

        if (!locationId || !phone) {
            alert("Não foi possível detectar a conversa. Recarregue a página.");
            actionGroup.style.opacity = "1";
            actionGroup.style.pointerEvents = "auto";
            return;
        }

        try {
            // Convert blob to base64
            var reader = new FileReader();
            reader.onload = async function() {
                var base64 = reader.result.split(',')[1]; // Remove data:...;base64, prefix
                console.log("DOUG.TECH: Base64 ready, length:", base64.length);

                try {
                    var res = await fetch(SEND_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            audio: base64,
                            locationId: locationId,
                            phone: phone,
                            instanceId: instanceId
                        })
                    });

                    var data = await res.json();
                    console.log("DOUG.TECH: Send response:", data);

                    if (res.ok && data.success) {
                        console.log("DOUG.TECH: ✅ Audio sent successfully via", data.instance);
                    } else {
                        console.error("DOUG.TECH: ❌ Send failed:", data);
                        alert("Erro ao enviar áudio: " + (data.error || "Erro desconhecido"));
                    }
                } catch (err) {
                    console.error("DOUG.TECH: ❌ Network error:", err);
                    alert("Erro de rede ao enviar áudio.");
                }

                fullReset();
                actionGroup.style.opacity = "1";
                actionGroup.style.pointerEvents = "auto";
            };
            reader.readAsDataURL(audioBlob);
        } catch (err) {
            console.error("DOUG.TECH: Error converting audio:", err);
            fullReset();
            actionGroup.style.opacity = "1";
            actionGroup.style.pointerEvents = "auto";
        }
    }

    function togglePreview() {
        if(!audioPlayer) return;
        if(audioPlayer.paused) {
            audioPlayer.play(); actionGroup.children[1].innerHTML = ICONS.pause;
            audioPlayer.onended = function() { actionGroup.children[1].innerHTML = ICONS.play; };
        } else {
            audioPlayer.pause(); actionGroup.children[1].innerHTML = ICONS.play;
        }
    }

    function fullReset() {
        if(audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
        if(currentStream) { currentStream.getTracks().forEach(function(t) { t.stop(); }); currentStream = null; }
        mediaRecorder = null; audioChunks = []; audioBlob = null; isRecording = false; stopTimer();
        if(mainBtn) {
            mainBtn.innerHTML = ICONS.mic; mainBtn.style.display = 'block'; actionGroup.style.display = 'none';
            timerDisplay.style.display = 'none';
            timerDisplay.innerText = "00:00";
        }
    }

    function startTimer() {
        startTime = Date.now();
        timerInterval = setInterval(function() {
            var diff = Math.floor((Date.now() - startTime) / 1000);
            var m = Math.floor(diff / 60).toString().padStart(2,'0');
            var s = (diff % 60).toString().padStart(2,'0');
            timerDisplay.innerText = m + ':' + s;
        }, 1000);
    }
    function stopTimer() { clearInterval(timerInterval); }

    var observer = new MutationObserver(function() { if (!document.getElementById('doug-maestro-ui')) createUI(); });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(createUI, 1500);
})();`;

// =====================================================================
// MAIN HANDLER
// =====================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // POST: Handle audio send
  if (req.method === "POST") {
    return handleAudioSend(req);
  }

  // GET: Serve the Ghost Recorder script
  return new Response(GHOST_RECORDER_SCRIPT, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
    },
  });
});
