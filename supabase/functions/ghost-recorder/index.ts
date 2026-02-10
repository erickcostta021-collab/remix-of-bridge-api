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

    // Detecta o melhor mimeType suportado pelo navegador
    function getPreferredMimeType() {
        var types = ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
        for (var i = 0; i < types.length; i++) {
            if (MediaRecorder.isTypeSupported(types[i])) {
                console.log("DOUG.TECH: Using mimeType: " + types[i]);
                return types[i];
            }
        }
        return '';
    }

    async function handleMainClick() {
        if (!isRecording) {
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                var mimeType = getPreferredMimeType();
                var options = mimeType ? { mimeType: mimeType } : {};
                mediaRecorder = new MediaRecorder(currentStream, options);
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
                var recMime = mediaRecorder.mimeType || 'audio/webm';
                audioBlob = new Blob(audioChunks, { type: recMime });
                var audioUrl = URL.createObjectURL(audioBlob);
                audioPlayer = new Audio(audioUrl);
                mainBtn.style.display = 'none'; timerDisplay.style.display = 'none'; actionGroup.style.display = 'flex';
                console.log("DOUG.TECH: Recorded as " + recMime + ", size: " + audioBlob.size);
            };
        }
    }

    // Converte AudioBuffer para WAV Blob
    function audioBufferToWav(buffer) {
        var numChannels = buffer.numberOfChannels;
        var sampleRate = buffer.sampleRate;
        var format = 1; // PCM
        var bitsPerSample = 16;
        
        var interleaved;
        if (numChannels === 2) {
            var left = buffer.getChannelData(0);
            var right = buffer.getChannelData(1);
            interleaved = new Float32Array(left.length + right.length);
            for (var i = 0, j = 0; i < left.length; i++) {
                interleaved[j++] = left[i];
                interleaved[j++] = right[i];
            }
        } else {
            interleaved = buffer.getChannelData(0);
        }
        
        var dataLength = interleaved.length * (bitsPerSample / 8);
        var headerLength = 44;
        var wavBuffer = new ArrayBuffer(headerLength + dataLength);
        var view = new DataView(wavBuffer);
        
        // RIFF header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
        view.setUint16(32, numChannels * (bitsPerSample / 8), true);
        view.setUint16(34, bitsPerSample, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        // Audio data
        var offset = 44;
        for (var k = 0; k < interleaved.length; k++, offset += 2) {
            var s = Math.max(-1, Math.min(1, interleaved[k]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }
    
    function writeString(view, offset, str) {
        for (var i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    // Converte blob de áudio para WAV usando Web Audio API
    async function convertToWav(blob) {
        try {
            var arrayBuffer = await blob.arrayBuffer();
            var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            var audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            var wavBlob = audioBufferToWav(audioBuffer);
            audioCtx.close();
            console.log("DOUG.TECH: Converted to WAV, size: " + wavBlob.size);
            return wavBlob;
        } catch(e) {
            console.error("DOUG.TECH: WAV conversion failed, using original", e);
            return blob;
        }
    }

    async function handleSend() {
        if (!audioBlob) return;
        
        // UI Feedback imediato
        actionGroup.style.opacity = "0.5";
        actionGroup.style.pointerEvents = "none";

        try {
            // Sempre força audio/mpeg com extensão .mp3 independente do formato original
            var blobToUse = audioBlob;
            var mimeType = audioBlob.type || '';
            
            // Se não é mp4/aac nativo, converte para WAV primeiro (dados reais)
            if (mimeType.indexOf('mp4') === -1 && mimeType.indexOf('aac') === -1 && mimeType.indexOf('mpeg') === -1) {
                blobToUse = await convertToWav(audioBlob);
            }
            
            // Força MIME type audio/mpeg e extensão .mp3 para o GHL aceitar
            var fileToUpload = new File([blobToUse], 'record.mp3', { type: 'audio/mpeg' });
            
            console.log("DOUG.TECH: fileToUpload BEFORE injection:", {
                name: fileToUpload.name,
                type: fileToUpload.type,
                size: fileToUpload.size,
                originalType: mimeType
            });
            
            nativeGHLUpload(fileToUpload);
        } catch(e) {
            console.error("DOUG.TECH: Send error", e);
        }
        
        // Reset após o burst
        setTimeout(function() {
            fullReset();
            actionGroup.style.opacity = "1";
            actionGroup.style.pointerEvents = "auto";
        }, 2500);
    }

    function nativeGHLUpload(file) {
        try {
            var fileInput = document.querySelector('input[type="file"].hr-upload-file-input') || 
                            document.querySelector('input[type="file"][multiple]');
            
            if (fileInput) {
                // Remove atributo accept que pode estar bloqueando áudios
                if (fileInput.hasAttribute('accept')) {
                    console.log("DOUG.TECH: Removing accept attribute: " + fileInput.getAttribute('accept'));
                    fileInput.removeAttribute('accept');
                }
                
                var dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                
                console.log("DOUG.TECH: File injected - name: " + file.name + ", type: " + file.type + ", size: " + file.size);
                
                var attempts = 0;
                var burstInterval = setInterval(function() {
                    var success = forceSendClick();
                    attempts++;
                    if (success || attempts > 30) {
                        clearInterval(burstInterval);
                    }
                }, 50); 
            } else {
                console.warn("DOUG.TECH: No file input found");
            }
        } catch(e) { console.error("DOUG.TECH: Erro injection", e); }
    }

    function forceSendClick() {
        var buttons = Array.from(document.querySelectorAll('button'));
        var sendBtn = buttons.find(function(b) { return b.innerHTML.includes('M2.01 21L23 12 2.01 3'); });

        if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            return true;
        } 
        
        var textarea = document.querySelector('textarea');
        if(textarea) {
            textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true }));
        }
        return false;
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
            timerDisplay.innerText = m + ":" + s;
        }, 1000);
    }
    function stopTimer() { clearInterval(timerInterval); }

    var observer = new MutationObserver(function() { if (!document.getElementById('doug-maestro-ui')) createUI(); });
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
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
});
