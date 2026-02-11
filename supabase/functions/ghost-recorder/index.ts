const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const GHOST_RECORDER_SCRIPT = `(function() {
    console.log("\\ud83d\\ude80 Ghost Recorder: Iniciando Stevo Engine V4...");

    var mediaRecorder = null, currentStream = null, audioChunks = [], audioBlob = null;
    var isRecording = false, timerInterval, startTime;

    var ICONS = {
        mic: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-500"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>',
        stop: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-red-500 animate-pulse"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-400"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
        send: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-green-500"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'
    };

    // Convert WebM blob to WAV PCM 16-bit for maximum compatibility
    function convertToWav(blob) {
        return new Promise(function(resolve, reject) {
            var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            var reader = new FileReader();
            reader.onloadend = function() {
                audioCtx.decodeAudioData(reader.result, function(buffer) {
                    var numChannels = 1;
                    var sampleRate = buffer.sampleRate;
                    var samples = buffer.getChannelData(0);
                    var numSamples = samples.length;
                    var dataLength = numSamples * 2;
                    var bufferOut = new ArrayBuffer(44 + dataLength);
                    var view = new DataView(bufferOut);

                    function writeString(offset, str) {
                        for (var i = 0; i < str.length; i++) {
                            view.setUint8(offset + i, str.charCodeAt(i));
                        }
                    }

                    writeString(0, 'RIFF');
                    view.setUint32(4, 36 + dataLength, true);
                    writeString(8, 'WAVE');
                    writeString(12, 'fmt ');
                    view.setUint32(16, 16, true);
                    view.setUint16(20, 1, true);
                    view.setUint16(22, numChannels, true);
                    view.setUint32(24, sampleRate, true);
                    view.setUint32(28, sampleRate * numChannels * 2, true);
                    view.setUint16(32, numChannels * 2, true);
                    view.setUint16(34, 16, true);
                    writeString(36, 'data');
                    view.setUint32(40, dataLength, true);

                    var offset = 44;
                    for (var i = 0; i < numSamples; i++) {
                        var s = Math.max(-1, Math.min(1, samples[i]));
                        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                        offset += 2;
                    }

                    var wavBlob = new Blob([bufferOut], { type: 'audio/wav' });
                    audioCtx.close();
                    resolve(wavBlob);
                }, function(err) {
                    audioCtx.close();
                    reject(err);
                });
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }

    // Inject audio into GHL via DataTransfer bypass
    function injectAudioToGHL(wavBlob) {
        return wavBlob.arrayBuffer().then(function(buffer) {
            // Mask as video/mp4 to bypass GHL validation (Erro 415)
            var maskedBlob = new Blob([buffer], { type: 'video/mp4' });
            var file = new File([maskedBlob], 'voice-msg-' + Date.now() + '.mp4', {
                type: 'video/mp4',
                lastModified: Date.now()
            });

            var fileInput = document.querySelector('input[type="file"].hr-upload-file-input') ||
                            document.querySelector('input[type="file"][multiple]');

            if (!fileInput) {
                console.error("\\u274c File input n\\u00e3o encontrado");
                // Fallback: try to find any file input
                fileInput = document.querySelector('input[type="file"]');
                if (!fileInput) return false;
            }

            // Bypass OS file selector with stopImmediatePropagation
            var clickHandler = function(e) {
                e.stopImmediatePropagation();
                e.preventDefault();
            };
            fileInput.addEventListener('click', clickHandler, true);

            var dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;

            // Remove bypass handler
            fileInput.removeEventListener('click', clickHandler, true);

            // Simulate events to trigger GHL internal state
            fileInput.dispatchEvent(new Event('focus', { bubbles: true }));
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));

            console.log("\\ud83d\\udce4 Arquivo injetado no input");

            setTimeout(function() {
                // Try to click send button via SVG path
                var sendPath = document.querySelector('button svg path[d*="M2.01 21L23 12"]');
                var sendBtn = sendPath ? sendPath.closest('button') : null;
                if (sendBtn && !sendBtn.disabled) {
                    sendBtn.click();
                    console.log("\\u2705 Enviado via bot\\u00e3o send");
                } else {
                    // Fallback: Enter key on textarea
                    var textarea = document.querySelector('textarea');
                    if (textarea) {
                        textarea.focus();
                        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                        console.log("\\u2705 Enviado via Enter fallback");
                    } else {
                        console.warn("\\u26a0\\ufe0f Nenhum m\\u00e9todo de envio encontrado");
                    }
                }
                fullReset();
            }, 1500);

            return true;
        });
    }

    function handleSend() {
        if (!audioBlob) return;
        var group = document.getElementById('ghost-action-group');
        group.style.opacity = "0.5";
        group.style.pointerEvents = "none";

        console.log("\\u23f3 Convertendo \\u00e1udio para WAV...");

        convertToWav(audioBlob).then(function(wavBlob) {
            console.log("\\u2705 WAV gerado: " + (wavBlob.size / 1024).toFixed(2) + "KB");
            return injectAudioToGHL(wavBlob);
        }).then(function(success) {
            if (!success) {
                // Fallback: try with masked MP3 directly (no WAV conversion)
                console.log("\\u26a0\\ufe0f WAV falhou, tentando MP3 direto...");
                return audioBlob.arrayBuffer().then(function(buffer) {
                    var mp3Blob = new Blob([buffer], { type: 'audio/mpeg' });
                    var file = new File([mp3Blob], 'voice-msg-' + Date.now() + '.mp3', {
                        type: 'audio/mpeg',
                        lastModified: Date.now()
                    });

                    var fileInput = document.querySelector('input[type="file"].hr-upload-file-input') ||
                                    document.querySelector('input[type="file"][multiple]') ||
                                    document.querySelector('input[type="file"]');
                    if (!fileInput) {
                        alert("Erro: Input de arquivo n\\u00e3o encontrado no GHL.");
                        group.style.opacity = "1";
                        group.style.pointerEvents = "auto";
                        return;
                    }

                    var dt = new DataTransfer();
                    dt.items.add(file);
                    fileInput.files = dt.files;
                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

                    setTimeout(function() {
                        var sendPath = document.querySelector('button svg path[d*="M2.01 21L23 12"]');
                        var sendBtn = sendPath ? sendPath.closest('button') : null;
                        if (sendBtn && !sendBtn.disabled) sendBtn.click();
                        else {
                            var textarea = document.querySelector('textarea');
                            if (textarea) textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                        }
                        fullReset();
                    }, 1500);
                });
            }
        }).catch(function(err) {
            console.error("\\u274c Erro no envio:", err);
            alert("Erro ao enviar \\u00e1udio. Tente novamente.");
            group.style.opacity = "1";
            group.style.pointerEvents = "auto";
        });
    }

    function createUI() {
        var attachPath = 'M17.5 5.256V16.5a5.5 5.5 0 11-11 0V5.667a3.667 3.667 0 017.333 0v10.779a1.833 1.833 0 11-3.666 0V6.65';
        var attachIcon = document.querySelector('path[d="' + attachPath + '"]');
        var toolbar = (attachIcon ? attachIcon.closest('.flex') : null) || document.querySelector('.message-input-actions');

        if (toolbar && !document.getElementById('ghost-recorder-ui')) {
            var container = document.createElement('div');
            container.id = 'ghost-recorder-ui';
            container.style.cssText = "display: flex; align-items: center; margin-right: 8px; z-index: 100;";

            var mainBtn = document.createElement('div');
            mainBtn.id = "ghost-main-btn";
            mainBtn.innerHTML = ICONS.mic;
            mainBtn.style.cursor = "pointer";
            mainBtn.onclick = handleMainClick;

            var timerDisp = document.createElement('span');
            timerDisp.id = "ghost-timer";
            timerDisp.style.cssText = "display: none; font-size: 12px; font-weight: bold; color: #ef4444; margin: 0 5px;";
            timerDisp.innerText = "00:00";

            var group = document.createElement('div');
            group.id = "ghost-action-group";
            group.style.cssText = "display: none; align-items: center; gap: 8px; background: #f3f4f6; padding: 4px 10px; border-radius: 20px;";

            var bTrash = document.createElement('div'); bTrash.innerHTML = ICONS.trash; bTrash.onclick = fullReset; bTrash.style.cursor = 'pointer';
            var bSend = document.createElement('div'); bSend.innerHTML = ICONS.send; bSend.onclick = handleSend; bSend.style.cursor = 'pointer';

            group.appendChild(bTrash); group.appendChild(bSend);
            container.appendChild(timerDisp); container.appendChild(mainBtn); container.appendChild(group);
            toolbar.prepend(container);
            console.log("\\u2705 Interface Ghost Recorder criada");
        }
    }

    function handleMainClick() {
        var mb = document.getElementById('ghost-main-btn');
        var td = document.getElementById('ghost-timer');
        if (!isRecording) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
                currentStream = stream;
                var mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 
                               MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
                mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
                audioChunks = [];
                mediaRecorder.ondataavailable = function(e) { audioChunks.push(e.data); };
                mediaRecorder.onstop = function() {
                    audioBlob = new Blob(audioChunks, { type: mimeType });
                    mb.style.display = 'none'; td.style.display = 'none';
                    document.getElementById('ghost-action-group').style.display = 'flex';
                    console.log("\\ud83c\\udf99\\ufe0f Grava\\u00e7\\u00e3o: " + (audioBlob.size / 1024).toFixed(2) + "KB");
                };
                mediaRecorder.start();
                isRecording = true;
                mb.innerHTML = ICONS.stop; td.style.display = 'block';
                startTime = Date.now();
                timerInterval = setInterval(function() {
                    var elapsed = Math.floor((Date.now() - startTime) / 1000);
                    td.innerText = Math.floor(elapsed / 60).toString().padStart(2, '0') + ':' + (elapsed % 60).toString().padStart(2, '0');
                }, 1000);
                console.log("\\ud83d\\udd34 Gravando...");
            }).catch(function() { alert("Erro ao acessar microfone."); });
        } else {
            mediaRecorder.stop(); isRecording = false; clearInterval(timerInterval);
            currentStream.getTracks().forEach(function(t) { t.stop(); });
        }
    }

    function fullReset() {
        var g = document.getElementById('ghost-action-group'); if (g) { g.style.display = 'none'; g.style.opacity = '1'; g.style.pointerEvents = 'auto'; }
        var m = document.getElementById('ghost-main-btn'); if (m) { m.style.display = 'block'; m.innerHTML = ICONS.mic; }
        var t = document.getElementById('ghost-timer'); if (t) t.style.display = 'none';
        audioChunks = []; audioBlob = null; isRecording = false;
    }

    var observer = new MutationObserver(function() { if (!document.getElementById('ghost-recorder-ui')) createUI(); });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(createUI, 2000);
    setTimeout(createUI, 5000);

    console.log("\\u2705 Ghost Recorder V4 carregado");
})();`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  return new Response(GHOST_RECORDER_SCRIPT, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
});
