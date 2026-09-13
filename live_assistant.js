/**
 * ذِكْرى — مساعد الصوت المباشر (Live Voice Assistant Controller)
 * تنفيذ الواجهة العائمة وموجات الصوت التفاعلية الموضحة في الصورة الثانية
 */

let isListening = false;
let waveInterval = null;
let speechRecognizer = null;

function openLiveOverlay() {
  const overlay = document.getElementById('live-overlay');
  if (!overlay) return;

  overlay.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
  overlay.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');

  startWaveformAnimation();
  updateLiveStatus('«أنا كنسمع ليك دابا بالدارجة... كليكي على الميكرو وسولني!»');
}

function closeLiveOverlay() {
  const overlay = document.getElementById('live-overlay');
  if (!overlay) return;

  overlay.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
  overlay.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');

  stopWaveformAnimation();
  isListening = false;
}

function updateLiveStatus(text) {
  const statusEl = document.getElementById('live-voice-status');
  if (statusEl) {
    statusEl.textContent = text;
  }
}

// Waveform dynamic animation
function startWaveformAnimation() {
  const bars = document.querySelectorAll('#live-waveform .wave-bar');
  if (!bars || bars.length === 0) return;

  if (waveInterval) clearInterval(waveInterval);

  waveInterval = setInterval(() => {
    bars.forEach(bar => {
      const minH = 6;
      const maxH = isListening ? 28 : 14;
      const randomH = Math.floor(Math.random() * (maxH - minH + 1)) + minH;
      bar.style.height = `${randomH}px`;
    });
  }, 90);
}

function stopWaveformAnimation() {
  if (waveInterval) {
    clearInterval(waveInterval);
    waveInterval = null;
  }
}

// Toggle voice listening
function toggleVoiceListening() {
  const micBtn = document.getElementById('live-mic-btn');
  isListening = !isListening;

  if (isListening) {
    micBtn.classList.add('ring-4', 'ring-amber-500/50', 'scale-105');
    updateLiveStatus('«كنسمع ليك دابا... تكلم بالدارجة!»');

    // Simulated speech query cycle if real Web Speech API is not granted
    setTimeout(() => {
      simulateDarijaVoiceQuery();
    }, 1200);

  } else {
    micBtn.classList.remove('ring-4', 'ring-amber-500/50', 'scale-105');
    updateLiveStatus('«الميكرو موقف. كليكي عليه باش تسولني.»');
  }
}

// Simulated Darija Voice Cycle
function simulateDarijaVoiceQuery() {
  const questions = [
    {
      q: "فين كاين داك الفيديو ديال الطاجين؟",
      search: "طاجين",
      ans: "لقيت ليك فيديو وصفة الطاجين المغربي بالبرقوق اللي حفظتيه من YouTube!"
    },
    {
      q: "وقتاش عندي الرونديفو ديال الطبيب؟",
      search: "طبيب",
      ans: "عندك موعد مع د. الفاسي نهار الثلاثاء الجاي مع 16:30 فعيادة الأمل."
    },
    {
      q: "شكون صيفط ليا تصويرة العيد فواتساب؟",
      search: "صورة العيد",
      ans: "صيفطها ليك خوك أمين فواتساب نهار العيد الكبير فالعشية!"
    }
  ];

  // Pick random or cycle
  const picked = questions[Math.floor(Math.random() * questions.length)];

  updateLiveStatus(`«كنسمعك سولت: "${picked.q}"... جاري البحث...»`);

  setTimeout(() => {
    updateLiveStatus(`«${picked.ans}»`);

    // Voice response with Web Speech API
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(picked.ans);
      utter.lang = 'ar-XA';
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    }

    setTimeout(() => {
      closeLiveOverlay();
      document.getElementById('search-input').value = picked.search;
      executeSearch();
    }, 1800);
  }, 1400);
}

// Trigger screen share simulation (Screenshot 2: "Partager l'écran avec Live")
function triggerScreenShare() {
  alert("✨ ميزة مشاركة الشاشة الحية (Live Screen):\nيقوم مساعد «ذكرى» الآن بتحليل لقطة الشاشة الحالية واستخراج النصوص والعناصر لربطها بذكرياتك وملاحظاتك.");
  updateLiveStatus('«تمت مشاركة الشاشة بنجاح! يمكنني الآن قراءة ما تشاهده ومساعدتك فيه.»');
}
