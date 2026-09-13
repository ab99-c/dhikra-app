/* Dhikra Gallery Intelligence — privacy-first browser MVP.
 * Files are read only after explicit user selection and never uploaded.
 */
const galleryRecords = JSON.parse(localStorage.getItem('dhikra-gallery-records') || '[]');
let selectedGalleryFiles = [];

function escapeGalleryHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function formatGallerySize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatGalleryDate(value) {
  if (!value) return 'ما معروفش';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'ما معروفش';
  return new Intl.DateTimeFormat('ar-MA', {dateStyle: 'medium', timeStyle: 'short'}).format(d);
}

function dateOnly(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function readExifDate(file) {
  return new Promise(resolve => {
    if (!/^image\/jpe?g$/i.test(file.type)) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const view = new DataView(reader.result);
        if (view.getUint16(0, false) !== 0xFFD8) return resolve(null);
        let offset = 2;
        while (offset + 4 < view.byteLength) {
          if (view.getUint8(offset) !== 0xFF) break;
          const marker = view.getUint8(offset + 1);
          const length = view.getUint16(offset + 2, false);
          if (marker === 0xE1 && view.getUint32(offset + 4, false) === 0x45786966) {
            const tiff = offset + 10;
            const little = view.getUint16(tiff, false) === 0x4949;
            const u16 = (p) => view.getUint16(p, little);
            const u32 = (p) => view.getUint32(p, little);
            const firstIfd = tiff + u32(tiff + 4);
            const count = u16(firstIfd);
            for (let i = 0; i < count; i++) {
              const entry = firstIfd + 2 + (i * 12);
              if (entry + 12 > view.byteLength) break;
              const tag = u16(entry);
              if (tag === 0x0132 || tag === 0x9003) {
                const type = u16(entry + 2);
                const n = u32(entry + 4);
                const ptr = type === 2 && n <= 4 ? entry + 8 : tiff + u32(entry + 8);
                let text = '';
                for (let j = 0; j < n && ptr + j < view.byteLength; j++) text += String.fromCharCode(view.getUint8(ptr + j));
                const parsed = text.trim().replace(/^([0-9]{4}):([0-9]{2}):([0-9]{2})/, '$1-$2-$3').replace(' ', 'T');
                const d = new Date(parsed);
                if (!Number.isNaN(d.getTime())) return resolve(d.toISOString());
              }
            }
          }
          offset += 2 + length;
        }
      } catch (_) {}
      resolve(null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file.slice(0, Math.min(file.size, 2 * 1024 * 1024)));
  });
}

function inferImageMeaning(file, note) {
  const haystack = `${file.name} ${note}`.toLowerCase();
  const rules = [
    [/عيد|ضحى|عائلة|family|holiday/, 'غالباً صورة مناسبة أو تجمع عائلي'],
    [/طاجين|وصفة|recipe|food|ماكلة|كسكس/, 'غالباً صورة وصفة أو ماكلة بغرض الرجوع ليها من بعد'],
    [/screenshot|سكرين|لقطة|capture|rib|فاتورة|invoice|موعد/, 'غالباً لقطة شاشة فيها معلومة عملية خاصها تبقى محفوظة'],
    [/whatsapp|واتساب/, 'غالباً صورة أو وثيقة توصّلات بها من واتساب'],
    [/travel|vacation|سفر|شاطئ|beach/, 'غالباً ذكرى ديال سفر أو مكان زرتيه']
  ];
  return rules.find(([pattern]) => pattern.test(haystack))?.[1] || 'صورة شخصية؛ زيد وصف صغير باش «ذكرى» تفهم علاش مهمة ليك.';
}

async function extractGalleryText(file, status) {
  if (!window.Tesseract || file.size > 8 * 1024 * 1024) return '';
  try {
    const result = await window.Tesseract.recognize(file, 'ara+eng', {
      logger: message => {
        if (message.status === 'recognizing text' && status) status.textContent = `OCR كيقرا النص من ${file.name}… ${Math.round((message.progress || 0) * 100)}%`;
      }
    });
    return (result.data?.text || '').trim().slice(0, 1200);
  } catch (_) {
    return '';
  }
}

async function analyzeGalleryFile(file, note = '', status = null) {
  return new Promise(resolve => {
    const fallbackDate = file.lastModified ? new Date(file.lastModified).toISOString() : null;
    const record = {
      id: `gallery-${file.name}-${file.lastModified}-${file.size}`,
      name: file.name,
      type: file.type || 'image/*',
      size: file.size,
      modifiedAt: fallbackDate,
      exifAt: null,
      width: null,
      height: null,
      note,
      meaning: inferImageMeaning(file, note),
      ocrText: '',
      reminderDate: dateOnly(fallbackDate),
      reminderText: '',
      createdAt: new Date().toISOString()
    };
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      record.width = img.naturalWidth;
      record.height = img.naturalHeight;
      record.exifAt = await readExifDate(file);
      record.ocrText = await extractGalleryText(file, status);
      if (record.ocrText) record.meaning = inferImageMeaning(file, `${note} ${record.ocrText}`);
      record.displayDate = record.exifAt || record.modifiedAt;
      record.reminderDate = dateOnly(record.displayDate);
      record.previewUrl = objectUrl;
      resolve(record);
    };
    img.onerror = async () => {
      record.exifAt = await readExifDate(file);
      record.ocrText = await extractGalleryText(file, status);
      record.displayDate = record.exifAt || record.modifiedAt;
      record.reminderDate = dateOnly(record.displayDate);
      record.previewUrl = objectUrl;
      resolve(record);
    };
    img.src = objectUrl;
  });
}

function saveGalleryRecords() {
  localStorage.setItem('dhikra-gallery-records', JSON.stringify(galleryRecords.map(({previewUrl, ...record}) => record)));
}

function renderGalleryResults() {
  const container = document.getElementById('gallery-results');
  const count = document.getElementById('gallery-count');
  if (!container || !count) return;
  count.textContent = `${galleryRecords.length} صورة مفهرسة محلياً`;
  container.innerHTML = galleryRecords.length ? galleryRecords.slice().reverse().map(record => `
    <article class="bg-[#1b1c22] border border-white/10 rounded-2xl p-3 flex gap-3">
      <div class="w-20 h-20 rounded-xl bg-black/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
        ${record.previewUrl ? `<img src="${record.previewUrl}" alt="${escapeGalleryHtml(record.name)}" class="w-full h-full object-cover">` : '<span class="text-2xl">🖼️</span>'}
      </div>
      <div class="min-w-0 flex-1 text-[11px] text-gray-400">
        <h4 class="text-sm text-white font-bold truncate">${escapeGalleryHtml(record.name)}</h4>
        <p class="mt-1 text-amber-300">${escapeGalleryHtml(record.meaning)}</p>
        <p class="mt-1">التاريخ: <b class="text-gray-200">${escapeGalleryHtml(formatGalleryDate(record.displayDate || record.modifiedAt))}</b></p>
        <p>${escapeGalleryHtml(record.type)} · ${formatGallerySize(record.size)} · ${record.width || '?'}×${record.height || '?'}</p>
        ${record.ocrText ? `<p class="mt-1 text-gray-300 truncate">OCR: ${escapeGalleryHtml(record.ocrText)}</p>` : ''}
        <p class="text-emerald-300 mt-1">التذكير: ${record.reminderDate ? escapeGalleryHtml(record.reminderDate) : 'ما تحددش'}</p>
      </div>
    </article>`).join('') : '<p class="text-xs text-gray-500 text-center py-4">اختار صور من Gallery باش يبان التحليل هنا.</p>';
}

async function analyzeSelectedGallery() {
  const input = document.getElementById('gallery-input');
  const note = document.getElementById('gallery-note')?.value.trim() || '';
  const status = document.getElementById('gallery-status');
  if (!input?.files?.length) {
    if (status) status.textContent = 'اختار صورة وحدة على الأقل.';
    return;
  }
  selectedGalleryFiles = [...input.files];
  if (status) status.textContent = `كنحللو ${selectedGalleryFiles.length} صورة محلياً...`;
  const records = await Promise.all(selectedGalleryFiles.map(file => analyzeGalleryFile(file, note, status)));
  records.forEach(record => {
    const oldIndex = galleryRecords.findIndex(item => item.id === record.id);
    if (oldIndex >= 0) galleryRecords[oldIndex] = record;
    else galleryRecords.push(record);
  });
  saveGalleryRecords();
  renderGalleryResults();
  if (status) status.textContent = `تسالات الفهرسة: ${records.length} صورة. الصور ما خرجاتش من الجهاز.`;
  input.value = '';
}

function setGalleryReminder() {
  const date = document.getElementById('gallery-reminder-date')?.value;
  const text = document.getElementById('gallery-reminder-text')?.value.trim() || 'راجع هاد الذكرى';
  const status = document.getElementById('gallery-status');
  if (!date) { if (status) status.textContent = 'اختار نهار التذكير.'; return; }
  galleryRecords.forEach(record => { record.reminderDate = date; record.reminderText = text; });
  saveGalleryRecords();
  renderGalleryResults();
  if (status) status.textContent = `تسجل التذكير لـ ${date}. فنسخة الويب كيبان داخل التطبيق ملي يوافق النهار.`;
}

function checkGalleryReminders() {
  const today = new Date().toISOString().slice(0, 10);
  const due = galleryRecords.filter(record => record.reminderDate === today);
  const badge = document.getElementById('gallery-reminder-badge');
  if (badge) badge.textContent = due.length ? `اليوم: ${due.length} تذكير على صورك` : 'ما كاين حتى تذكير اليوم';
}

document.addEventListener('DOMContentLoaded', () => {
  renderGalleryResults();
  checkGalleryReminders();
  document.getElementById('gallery-input')?.addEventListener('change', e => {
    const status = document.getElementById('gallery-status');
    if (status) status.textContent = `${e.target.files.length} صورة واجدة للتحليل المحلي.`;
  });
});
