const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const GHOST_RECORDER_SCRIPT = `/**
 * 🚀 DOUG.TECH - GHOST RECORDER v2 (SERVER-SIDE UPLOAD)
 * Envia áudio via API server-side, sem injeção no DOM.
 */
(function() {
    console.log("🚀 DOUG.TECH: Ghost Recorder v2 - Server Upload Mode");

    const API_BASE = "https://jsupvprudyxyiyxwqxuq.supabase.co/functions/v1/ghost-recorder-upload";

    let mediaRecorder = null;
    let currentStream = null;
    let audioChunks = [];
    let audioBlob = null;
    let audioPlayer = null;
    let isRecording = false;
    let timerInterval;
    let startTime;

    function audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const data = numChannels === 1 ? buffer.getChannelData(0) : interleave(buffer);
        const dataLength = data.length * bytesPerSample;
        const headerLength = 44;
        const totalLength = headerLength + dataLength;
        const arrayBuffer = new ArrayBuffer(totalLength);
        const view = new DataView(arrayBuffer);

        function writeString(offset, str) { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }

        writeString(0, 'RIFF');
        view.setUint32(4, totalLength - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);

        let offset = 44;
        for (let i = 0; i < data.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, data[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    function interleave(buffer) {
        const len = buffer.length;
        const channels = buffer.numberOfChannels;
        const result = new Float32Array(len * channels);
        let idx = 0;
        for (let i = 0; i < len; i++) {
            for (let ch = 0; ch < channels; ch++) {
                result[idx++] = buffer.getChannelData(ch)[i];
            }
        }
        return result;
    }

    async function convertToWav(webmBlob) {
        const arrayBuffer = await webmBlob.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioCtx.close();
        return audioBufferToWav(audioBuffer);
    }

    // Extrai locationId e conversationId da URL do GHL
    function getGHLContext() {
        const url = window.location.href;
        // URL pattern: /v2/location/{locationId}/conversations/{conversationId}
        const locMatch = url.match(/\\/location\\/([a-zA-Z0-9]+)/);
        const convMatch = url.match(/\\/conversations\\/([a-zA-Z0-9]+)/);
        // Alt: query params or hash
        const params = new URLSearchParams(window.location.search);
        
        return {
            locationId: locMatch ? locMatch[1] : params.get('locationId'),
            conversationId: convMatch ? convMatch[1] : params.get('conversationId')
        };
    }

    const ICONS = {
        mic: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-500 hover:text-gray-700"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>',
        stop: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-red-500 animate-pulse"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>',
        play: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-blue-600"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-blue-600"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-400 hover:text-red-500"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
        send: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-green-500 hover:text-green-600"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
        loading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-5 h-5 text-green-500 animate-spin"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>'
    };

    let container, mainBtn, actionGroup, timerDisplay;

    function createUI() {
        const toolbar = document.querySelector('.message-input-actions') || 
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
            
            const btnPlay = document.createElement('div'); btnPlay.innerHTML = ICONS.play; btnPlay.onclick = togglePreview; btnPlay.style.cursor='pointer'; btnPlay.style.padding='4px';
            const btnTrash = document.createElement('div'); btnTrash.innerHTML = ICONS.trash; btnTrash.onclick = fullReset; btnTrash.style.cursor='pointer'; btnTrash.style.padding='4px';
            const btnSend = document.createElement('div'); btnSend.innerHTML = ICONS.send; btnSend.onclick = handleSend; btnSend.style.cursor='pointer'; btnSend.style.padding='4px'; btnSend.id = 'doug-send-btn';
            
            actionGroup.appendChild(btnTrash); actionGroup.appendChild(btnPlay); actionGroup.appendChild(btnSend);
            container.appendChild(timerDisplay); container.appendChild(mainBtn); container.appendChild(actionGroup);
            toolbar.insertBefore(container, toolbar.firstChild);
        }
    }

    async function handleMainClick() {
        if (!isRecording) {
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(currentStream);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
                mediaRecorder.start();
                isRecording = true;
                mainBtn.innerHTML = ICONS.stop; timerDisplay.style.display = 'block'; startTimer();
            } catch (err) { alert("Microfone bloqueado."); fullReset(); }
        } else {
            if (mediaRecorder) mediaRecorder.stop();
            isRecording = false; stopTimer();
            if (currentStream) currentStream.getTracks().forEach(t => t.stop());
            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                audioPlayer = new Audio(audioUrl);
                mainBtn.style.display = 'none'; timerDisplay.style.display = 'none'; actionGroup.style.display = 'flex';
            };
        }
    }

    async function handleSend() {
        if (!audioBlob) return;

        const ctx = getGHLContext();
        if (!ctx.locationId) {
            alert("Não foi possível detectar a localização. Abra uma conversa no GHL.");
            return;
        }
        if (!ctx.conversationId) {
            alert("Não foi possível detectar a conversa. Abra uma conversa no GHL.");
            return;
        }

        // UI: loading
        const sendBtn = document.getElementById('doug-send-btn');
        if (sendBtn) sendBtn.innerHTML = ICONS.loading;
        actionGroup.style.pointerEvents = "none";

        try {
            // Converter para WAV
            let finalBlob;
            try {
                finalBlob = await convertToWav(audioBlob);
                console.log('DOUG.TECH: WAV convertido, size:', finalBlob.size);
            } catch(e) {
                console.warn('DOUG.TECH: Fallback webm', e);
                finalBlob = audioBlob;
            }

            const formData = new FormData();
            formData.append('audio', new File([finalBlob], 'voice_message.wav', { type: 'audio/wav' }));
            formData.append('locationId', ctx.locationId);
            formData.append('conversationId', ctx.conversationId);

            console.log('DOUG.TECH: Enviando para API...', { locationId: ctx.locationId, conversationId: ctx.conversationId });

            const res = await fetch(API_BASE, {
                method: 'POST',
                body: formData
            });

            const result = await res.json();
            console.log('DOUG.TECH: Resposta API:', res.status, result);

            if (res.ok && result.success) {
                console.log('DOUG.TECH: ✅ Áudio enviado com sucesso!');
                fullReset();
            } else {
                console.error('DOUG.TECH: ❌ Erro no envio:', result);
                alert('Erro ao enviar áudio: ' + (result.error || 'Erro desconhecido'));
                if (sendBtn) sendBtn.innerHTML = ICONS.send;
                actionGroup.style.pointerEvents = "auto";
            }
        } catch(e) {
            console.error('DOUG.TECH: Erro:', e);
            alert('Erro ao enviar áudio. Verifique o console.');
            if (sendBtn) sendBtn.innerHTML = ICONS.send;
            actionGroup.style.pointerEvents = "auto";
        }
    }

    function togglePreview() {
        if(!audioPlayer) return;
        if(audioPlayer.paused) {
            audioPlayer.play(); actionGroup.children[1].innerHTML = ICONS.pause;
            audioPlayer.onended = () => actionGroup.children[1].innerHTML = ICONS.play;
        } else {
            audioPlayer.pause(); actionGroup.children[1].innerHTML = ICONS.play;
        }
    }

    function fullReset() {
        if(audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
        if(currentStream) { currentStream.getTracks().forEach(t => t.stop()); currentStream = null; }
        mediaRecorder = null; audioChunks = []; audioBlob = null; isRecording = false; stopTimer();
        if(mainBtn) {
            mainBtn.innerHTML = ICONS.mic; mainBtn.style.display = 'block'; actionGroup.style.display = 'none';
            timerDisplay.style.display = 'none';
            timerDisplay.innerText = "00:00";
        }
    }

    function startTimer() {
        startTime = Date.now();
        timerInterval = setInterval(() => {
            const diff = Math.floor((Date.now() - startTime) / 1000);
            const m = Math.floor(diff / 60).toString().padStart(2,'0');
            const s = (diff % 60).toString().padStart(2,'0');
            timerDisplay.innerText = m + ':' + s;
        }, 1000);
    }
    function stopTimer() { clearInterval(timerInterval); }

    const observer = new MutationObserver(() => { if (!document.getElementById('doug-maestro-ui')) createUI(); });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(createUI, 1500);
})();`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(GHOST_RECORDER_SCRIPT, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
});
