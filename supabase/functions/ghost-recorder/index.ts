const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const GHOST_RECORDER_SCRIPT = `/**
 * DOUG.TECH - GHOST RECORDER v3
 */
(function() {
    console.log("DOUG.TECH: Ghost Recorder v3 carregado");

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

    // Detect best supported recording format
    function getPreferredMimeType() {
        var candidates = [
            'audio/mp4',
            'audio/aac',
            'audio/mpeg',
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus'
        ];
        for (var i = 0; i < candidates.length; i++) {
            if (MediaRecorder.isTypeSupported(candidates[i])) {
                console.log("DOUG.TECH: Using mimeType:", candidates[i]);
                return candidates[i];
            }
        }
        console.log("DOUG.TECH: No preferred mimeType supported, using default");
        return '';
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
            mediaRecorder.onstop = async function() {
                var rawBlob = new Blob(audioChunks, { type: recordedMimeType });
                console.log("DOUG.TECH: Raw blob size:", rawBlob.size, "type:", rawBlob.type);

                // If recorded in mp4/aac, use directly; otherwise convert to WAV
                if (recordedMimeType.indexOf('mp4') !== -1 || recordedMimeType.indexOf('aac') !== -1 || recordedMimeType.indexOf('mpeg') !== -1) {
                    audioBlob = rawBlob;
                    console.log("DOUG.TECH: Using native mp4/aac recording");
                } else {
                    try {
                        audioBlob = await convertToWav(rawBlob);
                        console.log("DOUG.TECH: Converted to WAV, size:", audioBlob.size);
                    } catch(e) {
                        console.warn("DOUG.TECH: WAV conversion failed:", e);
                        audioBlob = rawBlob;
                    }
                }
                var audioUrl = URL.createObjectURL(audioBlob);
                audioPlayer = new Audio(audioUrl);
                mainBtn.style.display = 'none'; timerDisplay.style.display = 'none'; actionGroup.style.display = 'flex';
            };
        }
    }

    function convertToWav(blob) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function() {
                var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                audioCtx.decodeAudioData(reader.result).then(function(buffer) {
                    var sampleRate = Math.min(buffer.sampleRate, 16000);
                    var rawData = buffer.getChannelData(0);
                    
                    // Resample if needed
                    var data = rawData;
                    if (buffer.sampleRate !== sampleRate) {
                        var ratio = buffer.sampleRate / sampleRate;
                        var newLen = Math.floor(rawData.length / ratio);
                        data = new Float32Array(newLen);
                        for (var i = 0; i < newLen; i++) {
                            data[i] = rawData[Math.floor(i * ratio)];
                        }
                    }
                    
                    var wavBuf = encodeWav(data, sampleRate, 1);
                    resolve(new Blob([wavBuf], { type: 'audio/wav' }));
                    audioCtx.close();
                }).catch(function(err) {
                    reject(err);
                });
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }

    function encodeWav(samples, sampleRate, numChannels) {
        var bytesPerSample = 2;
        var blockAlign = numChannels * bytesPerSample;
        var dataSize = samples.length * bytesPerSample;
        var bufferSize = 44 + dataSize;
        var buffer = new ArrayBuffer(bufferSize);
        var view = new DataView(buffer);

        function w(offset, str) {
            for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        }

        w(0, 'RIFF');
        view.setUint32(4, bufferSize - 8, true);
        w(8, 'WAVE');
        w(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bytesPerSample * 8, true);
        w(36, 'data');
        view.setUint32(40, dataSize, true);

        var offset = 44;
        for (var i = 0; i < samples.length; i++) {
            var s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }
        return buffer;
    }

    async function handleSend() {
        if (!audioBlob) return;
        
        actionGroup.style.opacity = "0.5";
        actionGroup.style.pointerEvents = "none";

        var fileExt, fileMime;
        var blobType = audioBlob.type || '';
        if (blobType.indexOf('mp4') !== -1) { fileExt = 'mp4'; fileMime = 'audio/mp4'; }
        else if (blobType.indexOf('aac') !== -1) { fileExt = 'aac'; fileMime = 'audio/aac'; }
        else if (blobType.indexOf('wav') !== -1) { fileExt = 'wav'; fileMime = 'audio/wav'; }
        else if (blobType.indexOf('mpeg') !== -1) { fileExt = 'mp3'; fileMime = 'audio/mpeg'; }
        else { fileExt = 'webm'; fileMime = 'audio/webm'; }

        console.log("DOUG.TECH: Sending as", fileMime, "ext:", fileExt, "size:", audioBlob.size);
        
        var nativeFile = new File([audioBlob], 'audio_' + Date.now() + '.' + fileExt, { type: fileMime });
        nativeGHLUpload(nativeFile);
        
        setTimeout(function() {
            fullReset();
            actionGroup.style.opacity = "1";
            actionGroup.style.pointerEvents = "auto";
        }, 2000);
    }

    function nativeGHLUpload(file) {
        try {
            var fileInput = document.querySelector('input[type="file"].hr-upload-file-input') || 
                            document.querySelector('input[type="file"][multiple]') ||
                            document.querySelector('input[type="file"]');
            
            if (fileInput) {
                fileInput.removeAttribute('accept');

                var dt = new DataTransfer();
                dt.items.add(file);
                
                var nativeFileSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set;
                nativeFileSetter.call(fileInput, dt.files);
                
                fileInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                fileInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                
                try {
                    var dropEvent = new DragEvent('drop', { bubbles: true, composed: true, dataTransfer: dt });
                    fileInput.dispatchEvent(dropEvent);
                } catch(dropErr) {}
                
                var attempts = 0;
                var burstInterval = setInterval(function() {
                    var success = forceSendClick();
                    attempts++;
                    if (success || attempts > 40) {
                        clearInterval(burstInterval);
                    }
                }, 100); 
            } else {
                console.warn("DOUG.TECH: File input not found");
            }
        } catch(e) { console.error("DOUG.TECH: Erro injection", e); }
    }

    function forceSendClick() {
        var buttons = Array.from(document.querySelectorAll('button'));
        var sendBtn = buttons.find(function(b) { return b.innerHTML.indexOf('M2.01 21L23 12 2.01 3') !== -1; });

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
            timerDisplay.innerText = m + ':' + s;
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
      "Pragma": "no-cache",
    },
  });
});
