const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const GHOST_RECORDER_SCRIPT = `/**
 * 🚀 DOUG.TECH - GHOST RECORDER (NATIVE INJECTION MODE)
 * Envio exclusivo via interface do GHL.
 */
(function() {
    console.log("🚀 DOUG.TECH: Modo Injeção Nativa Ativado...");

    let mediaRecorder = null;
    let currentStream = null;
    let audioChunks = [];
    let audioBlob = null;
    let audioPlayer = null;
    let isRecording = false;
    let timerInterval;
    let startTime;

    const ICONS = {
        mic: \`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-500 hover:text-gray-700"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>\`,
        stop: \`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-red-500 animate-pulse"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>\`,
        play: \`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-blue-600"><path d="M8 5v14l11-7z"/></svg>\`,
        pause: \`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-blue-600"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>\`,
        trash: \`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-400 hover:text-red-500"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>\`,
        send: \`<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-green-500 hover:text-green-600"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>\`
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
            const btnSend = document.createElement('div'); btnSend.innerHTML = ICONS.send; btnSend.onclick = handleSend; btnSend.style.cursor='pointer'; btnSend.style.padding='4px';
            
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
                audioBlob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
                const audioUrl = URL.createObjectURL(audioBlob);
                audioPlayer = new Audio(audioUrl);
                mainBtn.style.display = 'none'; timerDisplay.style.display = 'none'; actionGroup.style.display = 'flex';
            };
        }
    }

    async function handleSend() {
        if (!audioBlob) return;
        
        // UI Feedback imediato
        actionGroup.style.opacity = "0.5";
        actionGroup.style.pointerEvents = "none";

        const nativeFile = new File([audioBlob], \`audio_voice_\${Date.now()}.ogg\`, { type: 'audio/ogg; codecs=opus' });
        nativeGHLUpload(nativeFile);
        
        // Reset após o burst
        setTimeout(() => {
            fullReset();
            actionGroup.style.opacity = "1";
            actionGroup.style.pointerEvents = "auto";
        }, 1500);
    }

    function nativeGHLUpload(file) {
        try {
            // Estratégia 1: Paste event no textarea (mais confiável com React)
            const textarea = document.querySelector('textarea') || 
                             document.querySelector('[contenteditable="true"]') ||
                             document.querySelector('.ql-editor');
            
            if (textarea) {
                textarea.focus();
                
                // ClipboardEvent constructor NÃO permite setar clipboardData de verdade.
                // Precisamos usar Object.defineProperty para simular corretamente.
                const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
                Object.defineProperty(pasteEvent, 'clipboardData', {
                    value: {
                        files: [file],
                        items: [{
                            kind: 'file',
                            type: file.type,
                            getAsFile: () => file
                        }],
                        getData: () => '',
                        types: ['Files']
                    }
                });
                
                textarea.dispatchEvent(pasteEvent);
                console.log("DOUG.TECH: Custom paste event with files dispatched");
                
                // Aguarda o GHL processar o arquivo antes de tentar enviar
                let attempts = 0;
                const burstInterval = setInterval(() => {
                    // Verifica se apareceu preview de arquivo antes de tentar enviar
                    const hasPreview = document.querySelector('[class*="attachment"]') ||
                                       document.querySelector('[class*="preview"]') ||
                                       document.querySelector('[class*="file-upload"]') ||
                                       document.querySelector('audio') ||
                                       document.querySelector('[class*="media"]');
                    
                    if (hasPreview) {
                        console.log("DOUG.TECH: File preview detected, clicking send");
                        forceSendClick();
                        clearInterval(burstInterval);
                        return;
                    }
                    
                    attempts++;
                    if (attempts > 30) {
                        console.warn("DOUG.TECH: No file preview detected after paste, trying send anyway");
                        forceSendClick();
                        clearInterval(burstInterval);
                    }
                }, 200);
                return;
            }
            
            // Estratégia 2: Drop event na área do chat
            const chatArea = document.querySelector('.conversation-body') ||
                             document.querySelector('.message-list-wrapper') ||
                             document.querySelector('[class*="conversation"]') ||
                             document.querySelector('.hl_conversations--chat-body');
            
            if (chatArea) {
                const dt2 = new DataTransfer();
                dt2.items.add(file);
                
                const dragEnter = new DragEvent('dragenter', { bubbles: true, dataTransfer: dt2 });
                const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt2 });
                const dropEvt = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt2 });
                
                chatArea.dispatchEvent(dragEnter);
                chatArea.dispatchEvent(dragOver);
                chatArea.dispatchEvent(dropEvt);
                console.log("DOUG.TECH: Drop event dispatched on chat area");
                
                let attempts = 0;
                const burstInterval = setInterval(() => {
                    const success = forceSendClick();
                    attempts++;
                    if (success || attempts > 40) {
                        clearInterval(burstInterval);
                    }
                }, 150);
                return;
            }
            
            // Estratégia 3: File input como último recurso
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                // Simula clique no input e injeta via React setter
                const dt3 = new DataTransfer();
                dt3.items.add(file);
                const nativeFileSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set;
                nativeFileSetter.call(fileInput, dt3.files);
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log("DOUG.TECH: File input setter fallback used");
                
                let attempts = 0;
                const burstInterval = setInterval(() => {
                    const success = forceSendClick();
                    attempts++;
                    if (success || attempts > 40) {
                        clearInterval(burstInterval);
                    }
                }, 150);
            }
        } catch(e) { console.error("DOUG.TECH: Erro injection", e); }
    }

    function forceSendClick() {
        const buttons = Array.from(document.querySelectorAll('button'));
        const sendBtn = buttons.find(b => b.innerHTML.includes('M2.01 21L23 12 2.01 3'));

        if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            return true;
        } 
        
        const textarea = document.querySelector('textarea');
        if(textarea) {
            textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true }));
        }
        return false;
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
            timerDisplay.innerText = \`\${m}:\${s}\`;
        }, 1000);
    }
    function stopTimer() { clearInterval(timerInterval); }

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
