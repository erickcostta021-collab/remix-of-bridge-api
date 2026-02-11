const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const GHOST_RECORDER_SCRIPT = `/**
 * \\ud83d\\ude80 DOUG.TECH - GHOST RECORDER (TYPE MASKING EDITION)
 * Resolve o Erro 415 do LeadConnector/GHL mascarando o WAV como MP3.
 */
(function() {
    console.log("\\ud83d\\ude80 DOUG.TECH: Ativando Type Masking para Bypass 415...");

    var mediaRecorder = null, currentStream = null, audioChunks = [], audioBlob = null;
    var isRecording = false, timerInterval, startTime;

    var ICONS = {
        mic: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-500"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>',
        stop: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-red-500 animate-pulse"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>',
        send: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-green-500"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-400"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>'
    };

    function convertToWav(blob) {
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        return blob.arrayBuffer().then(function(arrayBuffer) {
            return audioCtx.decodeAudioData(arrayBuffer);
        }).then(function(audioBuffer) {
            var length = audioBuffer.length * 2 + 44;
            var view = new DataView(new ArrayBuffer(length));
            var writeString = function(o, s) { for (var i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
            writeString(0, 'RIFF'); view.setUint32(4, length - 8, true); writeString(8, 'WAVE');
            writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
            view.setUint16(22, 1, true); view.setUint32(24, 44100, true); view.setUint32(28, 44100 * 2, true);
            view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeString(36, 'data');
            view.setUint32(40, length - 44, true);
            var offset = 44;
            var channelData = audioBuffer.getChannelData(0);
            for (var i = 0; i < channelData.length; i++, offset += 2) {
                var s = Math.max(-1, Math.min(1, channelData[i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
            return new Blob([view], { type: 'audio/mpeg' });
        });
    }

    function handleSend() {
        if (!audioBlob) return;
        var group = document.getElementById('doug-action-group');
        group.style.opacity = "0.5"; group.style.pointerEvents = "none";

        console.log("\\ud83d\\ude80 DOUG.TECH: Processando \\u00e1udio para GHL...");
        convertToWav(audioBlob).then(function(wavBlobMasked) {
            var file = new File([wavBlobMasked], 'audio_record_' + Date.now() + '.mp3', {
                type: 'audio/mpeg',
                lastModified: Date.now()
            });

            var realInput = document.querySelector('input[type="file"].hr-upload-file-input') ||
                            document.querySelector('input[type="file"][multiple]');

            if (realInput) {
                var dt = new DataTransfer();
                dt.items.add(file);
                realInput.files = dt.files;

                var eOpts = { bubbles: true, cancelable: true, composed: true };
                realInput.dispatchEvent(new Event('change', eOpts));
                realInput.dispatchEvent(new Event('input', eOpts));

                setTimeout(function() {
                    var sendPath = document.querySelector('button svg path[d*="M2.01 21L23 12"]');
                    var sendBtn = sendPath ? sendPath.closest('button') : null;
                    if (sendBtn) sendBtn.click();
                    fullReset();
                }, 1200);
            } else {
                console.error("Input n\\u00e3o encontrado");
                fullReset();
            }
        });
    }

    function createUI() {
        var attachPath = 'M17.5 5.256V16.5a5.5 5.5 0 11-11 0V5.667a3.667 3.667 0 017.333 0v10.779a1.833 1.833 0 11-3.666 0V6.65';
        var attachIcon = document.querySelector('path[d="' + attachPath + '"]');
        var toolbar = (attachIcon ? attachIcon.closest('.flex') : null) || document.querySelector('.message-input-actions');
        if (toolbar && !document.getElementById('doug-maestro-ui')) {
            var container = document.createElement('div');
            container.id = 'doug-maestro-ui';
            container.style.cssText = "display: flex; align-items: center; margin-right: 8px; z-index: 100;";
            var mb = document.createElement('div'); mb.id = "doug-main-btn"; mb.innerHTML = ICONS.mic; mb.style.cursor = "pointer"; mb.onclick = handleMainClick;
            var td = document.createElement('span'); td.id = "doug-timer"; td.style.cssText = "display: none; font-size: 12px; font-weight: bold; color: #ef4444; margin: 0 5px;"; td.innerText = "00:00";
            var g = document.createElement('div'); g.id = "doug-action-group"; g.style.cssText = "display: none; align-items: center; gap: 8px; background: #f3f4f6; padding: 4px 10px; border-radius: 20px;";
            var bt = document.createElement('div'); bt.innerHTML = ICONS.trash; bt.onclick = fullReset; bt.style.cursor='pointer';
            var bs = document.createElement('div'); bs.innerHTML = ICONS.send; bs.onclick = handleSend; bs.style.cursor='pointer';
            g.appendChild(bt); g.appendChild(bs);
            container.appendChild(td); container.appendChild(mb); container.appendChild(g);
            toolbar.prepend(container);
        }
    }

    function handleMainClick() {
        var mb = document.getElementById('doug-main-btn');
        var td = document.getElementById('doug-timer');
        if (!isRecording) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function(s) {
                currentStream = s;
                mediaRecorder = new MediaRecorder(s);
                audioChunks = [];
                mediaRecorder.ondataavailable = function(e) { audioChunks.push(e.data); };
                mediaRecorder.onstop = function() {
                    audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    mb.style.display = 'none'; td.style.display = 'none';
                    document.getElementById('doug-action-group').style.display = 'flex';
                };
                mediaRecorder.start();
                isRecording = true;
                mb.innerHTML = ICONS.stop; td.style.display = 'block'; startTimer();
            });
        } else {
            mediaRecorder.stop(); isRecording = false; stopTimer();
            currentStream.getTracks().forEach(function(t) { t.stop(); });
        }
    }

    function startTimer() { startTime = Date.now(); timerInterval = setInterval(function() { var d = Math.floor((Date.now() - startTime) / 1000); document.getElementById('doug-timer').innerText = Math.floor(d/60).toString().padStart(2,'0') + ':' + (d%60).toString().padStart(2,'0'); }, 1000); }
    function stopTimer() { clearInterval(timerInterval); }
    function fullReset() {
        var g = document.getElementById('doug-action-group'); if(g) { g.style.display = 'none'; g.style.opacity = "1"; g.style.pointerEvents = "auto"; }
        var m = document.getElementById('doug-main-btn'); if(m) { m.style.display = 'block'; m.innerHTML = ICONS.mic; }
        var t = document.getElementById('doug-timer'); if(t) t.style.display = 'none';
        audioChunks = []; audioBlob = null; isRecording = false;
    }

    var observer = new MutationObserver(function() { if (!document.getElementById('doug-maestro-ui')) createUI(); });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(createUI, 2000);
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
