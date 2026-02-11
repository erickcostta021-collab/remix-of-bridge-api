const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const GHOST_RECORDER_SCRIPT = `/**
 * 🚀 DOUG.TECH - GHOST RECORDER (ANTI-415 STEALTH MODE)
 * Mimetismo profundo de arquivos do sistema para burlar o validador do GHL.
 */
(function() {
    console.log("🚀 DOUG.TECH: Iniciando Stealth Injection...");

    var mediaRecorder = null, currentStream = null, audioChunks = [], audioBlob = null, audioPlayer = null;
    var isRecording = false, timerInterval, startTime;

    var ICONS = {
        mic: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-500 hover:text-gray-700"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>',
        stop: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-red-500 animate-pulse"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>',
        play: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-blue-600"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-blue-600"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-400 hover:text-red-500"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
        send: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-green-500 hover:text-green-600"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'
    };

    function createUI() {
        var attachPath = document.querySelector('path[d*="M17.5 5.256V16.5"]');
        var toolbar = (attachPath ? attachPath.closest('.flex') : null) || 
                        document.querySelector('.message-input-actions') || 
                        document.querySelector('.toolbar-container');

        if (toolbar && !document.getElementById('doug-maestro-ui')) {
            var container = document.createElement('div');
            container.id = 'doug-maestro-ui';
            container.style.cssText = "display: flex; align-items: center; margin-right: 8px; z-index: 100;";

            var mainBtn = document.createElement('div');
            mainBtn.id = "doug-main-btn";
            mainBtn.innerHTML = ICONS.mic;
            mainBtn.style.cssText = "cursor: pointer; padding: 6px; border-radius: 50%;";
            mainBtn.onclick = handleMainClick;

            var timerDisplay = document.createElement('span');
            timerDisplay.id = "doug-timer";
            timerDisplay.innerText = "00:00";
            timerDisplay.style.cssText = "display: none; font-size: 13px; font-weight: 600; color: #ef4444; margin: 0 8px;";

            var actionGroup = document.createElement('div');
            actionGroup.id = "doug-action-group";
            actionGroup.style.cssText = "display: none; align-items: center; gap: 5px; background: #f3f4f6; padding: 4px; border-radius: 20px;";
            
            var btnPlay = document.createElement('div'); btnPlay.innerHTML = ICONS.play; btnPlay.onclick = togglePreview; btnPlay.style.cursor='pointer';
            var btnTrash = document.createElement('div'); btnTrash.innerHTML = ICONS.trash; btnTrash.onclick = fullReset; btnTrash.style.cursor='pointer';
            var btnSend = document.createElement('div'); btnSend.innerHTML = ICONS.send; btnSend.onclick = handleSend; btnSend.style.cursor='pointer';
            
            actionGroup.appendChild(btnTrash); actionGroup.appendChild(btnPlay); actionGroup.appendChild(btnSend);
            container.appendChild(timerDisplay); container.appendChild(mainBtn); container.appendChild(actionGroup);
            toolbar.insertBefore(container, toolbar.firstChild);
        }
    }

    async function handleSend() {
        if (!audioBlob) return;
        var group = document.getElementById('doug-action-group');
        group.style.opacity = "0.5"; group.style.pointerEvents = "none";

        var file = new File([audioBlob], 'VOICE_' + Date.now() + '.mp3', { 
            type: 'audio/mpeg',
            lastModified: new Date().getTime() 
        });
        
        Object.defineProperty(file, 'webkitRelativePath', { value: '' });

        injectAndSend(file);
    }

    function injectAndSend(file) {
        var fileInput = document.querySelector('input[type="file"].hr-upload-file-input') || 
                          document.querySelector('input[type="file"][multiple]');

        if (!fileInput) return console.error("DOUG.TECH: Input não encontrado");

        fileInput.value = '';
        fileInput.focus();

        var dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;

        var eConfig = { bubbles: true, cancelable: true, composed: true };
        
        fileInput.dispatchEvent(new Event('focus', eConfig));
        
        setTimeout(function() {
            fileInput.dispatchEvent(new Event('change', eConfig));
            fileInput.dispatchEvent(new Event('input', eConfig));
            
            setTimeout(function() {
                fileInput.dispatchEvent(new Event('blur', eConfig));
                
                var attempts = 0;
                var sendInterval = setInterval(function() {
                    var sendPath = document.querySelector('button svg path[d*="M2.01 21L23 12"]');
                    var sendBtn = sendPath ? sendPath.closest('button') : null;
                    if (sendBtn && !sendBtn.disabled) {
                        sendBtn.click();
                        clearInterval(sendInterval);
                        fullReset();
                    }
                    if (++attempts > 15) {
                        clearInterval(sendInterval);
                        var textarea = document.querySelector('textarea');
                        if(textarea) textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                        fullReset();
                    }
                }, 400);
            }, 200);
        }, 100);
    }

    function handleMainClick() {
        var mainBtn = document.getElementById('doug-main-btn');
        var timerDisplay = document.getElementById('doug-timer');
        if (!isRecording) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
                currentStream = stream;
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = function(e) { audioChunks.push(e.data); };
                mediaRecorder.start();
                isRecording = true;
                mainBtn.innerHTML = ICONS.stop; timerDisplay.style.display = 'block'; startTimer();
            });
        } else {
            mediaRecorder.stop();
            isRecording = false; stopTimer();
            currentStream.getTracks().forEach(function(t) { t.stop(); });
            mediaRecorder.onstop = function() {
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                audioPlayer = new Audio(URL.createObjectURL(audioBlob));
                mainBtn.style.display = 'none'; timerDisplay.style.display = 'none'; 
                document.getElementById('doug-action-group').style.display = 'flex';
            };
        }
    }
    function startTimer() { startTime = Date.now(); timerInterval = setInterval(function() { var diff = Math.floor((Date.now() - startTime) / 1000); document.getElementById('doug-timer').innerText = Math.floor(diff/60).toString().padStart(2,'0') + ':' + (diff%60).toString().padStart(2,'0'); }, 1000); }
    function stopTimer() { clearInterval(timerInterval); }
    function togglePreview() { if(audioPlayer) audioPlayer.paused ? audioPlayer.play() : audioPlayer.pause(); }
    function fullReset() {
        var group = document.getElementById('doug-action-group');
        if(group) { group.style.display = 'none'; group.style.opacity = "1"; group.style.pointerEvents = "auto"; }
        document.getElementById('doug-main-btn').style.display = 'block';
        document.getElementById('doug-main-btn').innerHTML = ICONS.mic;
        document.getElementById('doug-timer').style.display = 'none';
        audioChunks = []; audioBlob = null;
    }

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
