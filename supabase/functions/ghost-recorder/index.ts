const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const GHOST_RECORDER_SCRIPT = `/**
 * 🚀 DOUG.TECH - GHOST RECORDER (ULTRA STEALTH MODE)
 * Focado em mimetizar o clique humano no anexo do GHL.
 */
(function() {
    console.log("🚀 DOUG.TECH: Modo Ghost Ativado...");

    let mediaRecorder = null, currentStream = null, audioChunks = [], audioBlob = null, audioPlayer = null;
    let isRecording = false, timerInterval, startTime;

    const ICONS = {
        mic: \\\`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-500"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>\\\`,
        stop: \\\`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-red-500 animate-pulse"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>\\\`,
        play: \\\`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-blue-600"><path d="M8 5v14l11-7z"/></svg>\\\`,
        pause: \\\`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-blue-600"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>\\\`,
        trash: \\\`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-400"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>\\\`,
        send: \\\`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-green-500"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>\\\`
    };

    function createUI() {
        const toolbar = document.querySelector('.message-input-actions') || 
                        document.querySelector('.toolbar-container') ||
                        document.querySelector('.flex.flex-row.gap-2.items-center.pl-2');

        if (toolbar && !document.getElementById('doug-maestro-ui')) {
            const container = document.createElement('div');
            container.id = 'doug-maestro-ui';
            container.style.cssText = "display: flex; align-items: center; margin-right: 8px;";

            const mainBtn = document.createElement('div');
            mainBtn.id = "doug-main-btn";
            mainBtn.innerHTML = ICONS.mic;
            mainBtn.style.cssText = "cursor: pointer; padding: 6px; border-radius: 50%;";
            mainBtn.onclick = handleMainClick;

            const timerDisplay = document.createElement('span');
            timerDisplay.id = "doug-timer";
            timerDisplay.innerText = "00:00";
            timerDisplay.style.cssText = "display: none; font-size: 13px; font-weight: 600; color: #ef4444; margin: 0 8px;";

            const actionGroup = document.createElement('div');
            actionGroup.id = "doug-action-group";
            actionGroup.style.cssText = "display: none; align-items: center; gap: 5px; background: #f3f4f6; padding: 4px; border-radius: 20px;";
            
            const btnPlay = document.createElement('div'); btnPlay.innerHTML = ICONS.play; btnPlay.onclick = togglePreview; btnPlay.style.cursor='pointer';
            const btnTrash = document.createElement('div'); btnTrash.innerHTML = ICONS.trash; btnTrash.onclick = fullReset; btnTrash.style.cursor='pointer';
            const btnSend = document.createElement('div'); btnSend.innerHTML = ICONS.send; btnSend.onclick = handleSend; btnSend.style.cursor='pointer';
            
            actionGroup.appendChild(btnTrash); actionGroup.appendChild(btnPlay); actionGroup.appendChild(btnSend);
            container.appendChild(timerDisplay); container.appendChild(mainBtn); container.appendChild(actionGroup);
            toolbar.insertBefore(container, toolbar.firstChild);
        }
    }

    async function handleMainClick() {
        const mainBtn = document.getElementById('doug-main-btn');
        const timerDisplay = document.getElementById('doug-timer');
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
                mainBtn.style.display = 'none'; timerDisplay.style.display = 'none'; 
                document.getElementById('doug-action-group').style.display = 'flex';
            };
        }
    }

    async function handleSend() {
        if (!audioBlob) return;
        const group = document.getElementById('doug-action-group');
        group.style.opacity = "0.5"; group.style.pointerEvents = "none";

        const file = new File([audioBlob], \\\`voice_\\\${Date.now()}.mp3\\\`, { type: 'audio/mpeg' });
        
        const fileInput = document.querySelector('input[type="file"].hr-upload-file-input') || 
                          document.querySelector('input[type="file"][multiple]');

        if (fileInput) {
            const attachBtn = document.querySelector('path[d*="M17.5 5.256V16.5"]')?.closest('svg')?.parentElement;
            if (attachBtn) attachBtn.click();

            setTimeout(() => {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                
                const eventParams = { bubbles: true, cancelable: true, composed: true };
                fileInput.dispatchEvent(new Event('change', eventParams));
                fileInput.dispatchEvent(new Event('input', eventParams));

                setTimeout(() => {
                    forceSendClick();
                    fullReset();
                    group.style.opacity = "1"; group.style.pointerEvents = "auto";
                }, 1000);
            }, 300);
        }
    }

    function forceSendClick() {
        const sendBtn = document.querySelector('button svg path[d*="M2.01 21L23 12"]')?.closest('button');
        if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            return true;
        }
        const textarea = document.querySelector('textarea');
        if(textarea) {
            textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }
        return false;
    }

    function fullReset() {
        if(audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
        if(currentStream) { currentStream.getTracks().forEach(t => t.stop()); currentStream = null; }
        isRecording = false; stopTimer();
        const mainBtn = document.getElementById('doug-main-btn');
        const group = document.getElementById('doug-action-group');
        const timer = document.getElementById('doug-timer');
        if(mainBtn) {
            mainBtn.innerHTML = ICONS.mic; mainBtn.style.display = 'block';
            if(group) group.style.display = 'none';
            if(timer) { timer.style.display = 'none'; timer.innerText = "00:00"; }
        }
    }

    function startTimer() {
        startTime = Date.now();
        timerInterval = setInterval(() => {
            const diff = Math.floor((Date.now() - startTime) / 1000);
            document.getElementById('doug-timer').innerText = \\\`\\\${Math.floor(diff/60).toString().padStart(2,'0')}:\\\${(diff%60).toString().padStart(2,'0')}\\\`;
        }, 1000);
    }
    function stopTimer() { clearInterval(timerInterval); }
    function togglePreview() { if(audioPlayer) audioPlayer.paused ? audioPlayer.play() : audioPlayer.pause(); }

    const observer = new MutationObserver(() => { if (!document.getElementById('doug-maestro-ui')) createUI(); });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(createUI, 1500);
})();`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(GHOST_RECORDER_SCRIPT, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
