/**
 * ذِكْرى — محرك الاسترجاع الدلالي بالدارجة المغربية (Dhikra Local RAG Engine)
 */

// Initial Seed Memories (Matching user screenshots)
const defaultMemories = [
  {
    id: 1,
    title: "فيديو وصفة الطاجين",
    source: "يوتيوب : محفوظ مساء الجمعة",
    category: "وصفة",
    iconType: "youtube",
    tag: "اقتراح",
    badgeColor: "amber",
    hasProgressBar: true,
    progressPercent: 80,
    content: "طريقة تحضير طاجين اللحم بالبرقوق والمشمش المعسل مع التوابل المغربية وزيت العود واللوز مقلي",
    answer: "لقيت ليك فيديو وصفة الطاجين المغربي بالبرقوق اللي شفتيه فـ YouTube وحفظتيه نهار الجمعة فالليل!",
    keywords: ["طاجين", "وصفة", "طياب", "ماكلة", "برقوق", "يوتيوب", "لحم", "عشاء", "غداء"]
  },
  {
    id: 2,
    title: "موعد عند طبيب الأسنان",
    source: "التقويم : الثلاثاء 16:30 (عيادة الأمل)",
    category: "موعد الطبيب",
    iconType: "calendar",
    tag: "تقويم الهاتف",
    badgeColor: "blue",
    hasProgressBar: false,
    content: "موعد فحص الأسنان وتنظيف الجير عند الدكتور الفاسي بعيادة الأمل نهار الثلاثاء القادم 16:30",
    answer: "عندك رونديفو عند طبيب الأسنان (د. الفاسي) نهار الثلاثاء الجاي مع 16:30 فـ عيادة الأمل.",
    keywords: ["طبيب", "رونديفو", "موعد", "سنان", "عيادة", "فاسي", "تقويم", "الثلاثاء"]
  },
  {
    id: 3,
    title: "صورة العائلة - عيد الأضحى",
    source: "واتساب : مرسلة من عند أمين",
    category: "صورة العيد",
    iconType: "image",
    tag: "معالجة بصرية Clip",
    badgeColor: "emerald",
    hasProgressBar: false,
    content: "صورة جماعية للعائلة فسطح الدار مع الحولي فصباح عيد الأضحى مرسلة عبر واتساب",
    answer: "التصويرة ديال العيد صيفطها ليك خوك أمين فـ واتساب نهار العيد الكبير فالعشية!",
    keywords: ["صورة", "تصويرة", "عيد", "أمين", "واتساب", "عائلة", "حولي", "أضحى"]
  },
  {
    id: 4,
    title: "لقطة شاشة: رقم الحساب البنكي (RIB)",
    source: "ملاحظات : مستخرج بالنص العربي OCR",
    category: "حديث محفوظ",
    iconType: "doc",
    tag: "OCR آمن",
    badgeColor: "purple",
    hasProgressBar: false,
    content: "شهادة التعريف البنكي التجاري وفا بنك RIB: 007 780 0001234567890123 45 باسم أحمد",
    answer: "لقيت ليك سكرين شوت ديال الـ RIB البنكي ديالك (التجاري وفا بنك) اللي مسجلو فالملاحظات.",
    keywords: ["ريب", "rib", "بنك", "حساب", "تجاري", "فلوس", "سكرين", "شاشة", "نمرة"]
  }
];

let appMemories = [...defaultMemories];
let currentCategoryFilter = "وصفة";

// Cosine similarity and local vector generator simulation
function generateSimulatedVector(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  const vec = [];
  for (let i = 0; i < 8; i++) {
    const val = Math.sin(hash + i) * 0.5 + 0.5;
    vec.push(Number(val.toFixed(3)));
  }
  return vec;
}

// Render cards into phone screen
function renderCards(list) {
  const container = document.getElementById('cards-container');
  const countEl = document.getElementById('memories-count');
  if (!container) return;

  container.innerHTML = '';
  countEl.textContent = `الذكريات المطابقة (${list.length})`;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500 text-xs">
        <p>ما لقينا حتى ذكرى مطابقة للبحث ديالك بالدارجة.</p>
        <button onclick="resetSearch()" class="mt-2 text-amber-400 font-bold hover:underline">عرض كل الذكريات</button>
      </div>
    `;
    return;
  }

  list.forEach(item => {
    const card = document.createElement('div');
    card.className = "memory-card bg-[#1a1b20] border border-white/10 hover:border-amber-500/40 rounded-2xl p-3.5 transition group cursor-pointer shadow-sm";
    card.onclick = () => selectMemory(item);

    // Icon generator
    let iconSvg = '';
    if (item.iconType === 'youtube') {
      iconSvg = `
        <div class="w-9 h-9 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/30 flex-shrink-0">
          <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 22c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 2c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg>
        </div>
      `;
    } else if (item.iconType === 'calendar') {
      iconSvg = `
        <div class="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        </div>
      `;
    } else if (item.iconType === 'image') {
      iconSvg = `
        <div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        </div>
      `;
    } else {
      iconSvg = `
        <div class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30 flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
      `;
    }

    // Badge styling
    let badgeStyle = "bg-[#3a2815] text-amber-300 border-amber-600/30";
    if (item.badgeColor === 'blue') badgeStyle = "bg-blue-950 text-blue-300 border-blue-700/30";
    if (item.badgeColor === 'emerald') badgeStyle = "bg-emerald-950 text-emerald-300 border-emerald-700/30";
    if (item.badgeColor === 'purple') badgeStyle = "bg-purple-950 text-purple-300 border-purple-700/30";

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1">
          <h3 class="text-sm font-bold text-white mb-1 group-hover:text-amber-300 transition">${item.title}</h3>
          <p class="text-xs text-gray-400 flex items-center gap-1.5">
            <span>${item.source}</span>
          </p>
        </div>
        ${iconSvg}
      </div>
      <div class="mt-3 flex items-center justify-between">
        <span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-md border ${badgeStyle}">
          ${item.tag}
        </span>
        ${item.hasProgressBar ? `
          <div class="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 rounded-full" style="width: ${item.progressPercent}%"></div>
          </div>
        ` : `
          <span class="text-[10px] text-gray-500 font-mono">تطابق ${Math.round(85 + Math.random() * 14)}%</span>
        `}
      </div>
    `;

    container.appendChild(card);
  });
}

// Select a memory and update AI Answer Box
function selectMemory(item) {
  const answerBox = document.getElementById('ai-rag-box');
  const answerText = document.getElementById('ai-rag-text');
  const answerSource = document.getElementById('ai-rag-source');

  answerBox.classList.remove('hidden');
  answerText.textContent = item.answer;
  answerSource.textContent = `المصدر: ${item.source}`;

  // highlight
  filterCategory(item.category);
}

// Search and Darija RAG matching
function executeSearch() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  if (!query) {
    renderCards(appMemories);
    return;
  }

  // Filter based on Darija keywords and contents
  const results = appMemories.filter(m => {
    const matchCategory = m.category.toLowerCase().includes(query);
    const matchTitle = m.title.toLowerCase().includes(query);
    const matchContent = m.content.toLowerCase().includes(query);
    const matchKeyword = m.keywords && m.keywords.some(k => query.includes(k) || k.includes(query));
    return matchCategory || matchTitle || matchContent || matchKeyword;
  });

  const matched = results.length > 0 ? results[0] : appMemories[0];

  // Update AI Box
  const answerBox = document.getElementById('ai-rag-box');
  const answerText = document.getElementById('ai-rag-text');
  const answerSource = document.getElementById('ai-rag-source');

  answerBox.classList.remove('hidden');
  answerText.textContent = matched.answer;
  answerSource.textContent = `المصدر: ${matched.source}`;

  renderCards(results.length > 0 ? results : appMemories);
}

// Filter by category chip
function filterCategory(cat) {
  currentCategoryFilter = cat;
  
  // Highlight active chip
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.className = "chip-btn px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-gray-300 transition whitespace-nowrap";
  });
  const activeBtn = document.getElementById('chip-' + (cat === 'الكل' ? 'الكل' : cat));
  if (activeBtn) {
    activeBtn.className = "chip-btn px-3 py-1.5 rounded-xl border border-amber-500/50 bg-amber-500/20 text-amber-300 font-bold transition whitespace-nowrap";
  }

  if (cat === 'الكل') {
    renderCards(appMemories);
  } else {
    const filtered = appMemories.filter(m => m.category === cat);
    renderCards(filtered);
  }
}

// Reset search
function resetSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('bottom-ask-input').value = '';
  filterCategory('الكل');
}

// Run sample prompt from side panel
function runSamplePrompt(queryText) {
  setMainTab('app');
  document.getElementById('search-input').value = queryText;
  executeSearch();
}

// Self-learning feedback
function submitFeedback(isPositive) {
  alert(isPositive 
    ? "شكراً على التقييم! «ذكرى» زاد من أولوية هاد النتيجة للأسئلة المشابهة مستقبلاً (Re-ranking update)."
    : "تم تسجيل ملاحظتك. «ذكرى» غادي ينقص من ترتيب هاد الذكرى ويحسن النتائج القادمة.");
}

// Ingestion Form Handler
function submitNewMemory() {
  const title = document.getElementById('input-title').value.trim();
  const source = document.getElementById('input-source').value;
  const category = document.getElementById('input-cat').value;
  const content = document.getElementById('input-content').value.trim();

  if (!title || !content) return;

  const vector = generateSimulatedVector(content);

  const newMemory = {
    id: appMemories.length + 1,
    title: title,
    source: `${source} : تمت الإضافة حديثاً`,
    category: category,
    iconType: source === 'يوتيوب' ? 'youtube' : source === 'واتساب' ? 'image' : 'doc',
    tag: "محلي OCR",
    badgeColor: "amber",
    hasProgressBar: false,
    content: content,
    answer: `لقيت ليك "${title}" اللي سجلتيها من ${source}: ${content.substring(0, 60)}...`,
    keywords: title.split(/\s+/).concat(content.split(/\s+/).slice(0, 5))
  };

  appMemories.unshift(newMemory);

  // Show vector log
  const box = document.getElementById('vector-success-box');
  const details = document.getElementById('vector-success-details');
  box.classList.remove('hidden');
  details.innerHTML = `
    <strong>العنوان:</strong> ${title}<br>
    <strong>المتجه (Embedding Vector):</strong> [${vector.join(', ')}... 384 dimensions]<br>
    <strong>الخوارزمية:</strong> Multilingual MiniLM + Local Arabic OCR<br>
    <strong>مكان التخزين:</strong> مشفر في قاعدة بيانات الهاتف المحلية (On-Device SQLite-Vector)
  `;

  setTimeout(() => {
    setMainTab('app');
    document.getElementById('search-input').value = title;
    executeSearch();
  }, 1400);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  filterCategory('وصفة');
});
