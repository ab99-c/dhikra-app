# ذِكْرى (Dhikra) — مساعد الذاكرة الشخصي الذكي

<div dir="rtl">

**ذِكْرى** تطبيق شخصي كيجمع ليك الذكريات ديالك — نصوص، روابط، صور واقتباسات — وكيرجعهم ليك فالوقت المناسب، مع **chatbot بالدارجة المغربية** كيخدم بالـ RAG على الذكريات المحلية ديالك، وكيستخرج التواريخ باش يبرمج ليك التذكيرات.

البيانات كاملة **خاصة بيك**: المكتبة كتخزن محلياً على الجهاز (SQLite فـ native، AsyncStorage فـ web)، والسيرفر كيستعمل غير باش يجاوب على الأسئلة بالذكاء الاصطناعي.

## المزايا

- 📚 **مكتبة الذكريات المحلية**: ملاحظات، روابط، صور من المعرض — مع التصنيف (روحانيات، إنتاجية، وصفة، اقتباس…) وموعد الرجوع المفضل.
- 🤖 **Chatbot بالدارجة + RAG**: يسول على ذكرياتك («فين الصورة ديال العيد؟»)، يفهم نية التذكير («نعاود نشوف هاد المقال نهار الاثنين») ويرجع التاريخ بصيغة ISO 8601.
- 🔍 **بحث متسامح مع الدارجة**: normalization عربية في `shared/darija.ts` — «الجنه» كتلقى «الجنة»، «الاله» كتلقى «الإله»، والتشكيل (ذِكْرى/ذكرى) ما كيأثرش.
- 🔔 **تذكيرات + شاشة إدارة**: برمجة عبر `expo-notifications` على native، وتبويب «التذكيرات» باش تشوف القادمة، تعلّم عليها تمّت، تلغيها ولا تعاود تبرمجها.
- 🕌 **أذكار + ساعة (timezone)**: تبويب «الأذكار» فيه ساعة حية (وقتك + وقت الرباط)، تاريخ ميلادي وهجري، مسبحة إلكترونية (عداد 33) وأذكار الصباح/المساء مع تتبع يومي محفوظ — كامل offline.
- 🔁 **تتبع المراجعة**: كل مرة ترجع لذكرى كيتسجل `revisitCount` و الحالة.
- 🌓 **ثيم فاتح/غامق** عبر NativeWind + RTL كامل.

## Stack التقني

| Layer | Tech |
|---|---|
| Mobile/Web UI | Expo SDK 54 · React Native 0.81 · React 19 · expo-router |
| Styling | NativeWind 4 (Tailwind) + theme tokens في `theme.config.js` |
| State/API | tRPC 11 + @tanstack/react-query |
| Server | Express + tRPC adapter (`server/_core/index.ts`) |
| LLM | Manus Forge API عبر `server/_core/llm.ts` (retry + JSON schema) |
| Local DB | expo-sqlite (native) / AsyncStorage (web) |
| Cloud mirror | Drizzle ORM + MySQL schema في `drizzle/schema.ts` (مستقبلاً) |
| Tests | Vitest |

## هيكلة المشروع

```
app/                 # شاشات expo-router ((tabs), oauth/callback, dev/theme-lab)
components/          # UI components عامة
lib/                 # منطق العميل: content-library، reminders، trpc، auth
shared/              # أنواع وثوابت مشتركة بين العميل والسيرفر
server/              # سيرفر tRPC: routers، assistant (RAG + تذكير)، _core/
drizzle/             # سكيما MySQL + migrations
docs/                # SQLite schema مرجعي
tests/               # Vitest tests
```

## التشغيل محلياً

```bash
pnpm install
pnpm dev            # يشغّل السيرفر (tsx watch) + Metro للـ web
```

- Web: http://localhost:8081
- API: http://localhost:3000/api/trpc (المنفذ كيتزاد أوتوماتيكياً إلا كان مشغول)

### متغيرات البيئة (`.env`)

```
BUILT_IN_FORGE_API_URL=   # عنوان Forge API (اختياري)
BUILT_IN_FORGE_API_KEY=   # مفتاح LLM — لازملو للـ chatbot
JWT_SECRET=               # سر الكوكيز
DATABASE_URL=             # MySQL (اختياري دابا — السينك مستقبلاً)
OAUTH_SERVER_URL=         # خادم OAuth (Manus)
VITE_APP_ID= / OWNER_OPEN_ID=
```

## الأوامر

| الأمر | الوصف |
|---|---|
| `pnpm dev` | سيرفر + Metro معاً |
| `pnpm check` | TypeScript `--noEmit` |
| `pnpm test` | Vitest |
| `pnpm lint` | ESLint (config Expo) |
| `pnpm build` / `pnpm start` | بناء وتشغيل السيرفر للإنتاج |
| `pnpm db:push` | توليد وتطبيق Drizzle migrations |
| `pnpm qr` | توليد QR code لتجربة mobile |

## الاختبارات

22 اختبار خضراء تغطي: عقد التصنيفات، السكيما المرجعية، عقد المساعد (intents + dates)، جدولة التذكيرات، normalization الدارجة للبحث، محتوى الأذكار وتحويل التاريخ الهجري. اختبار `auth.logout` متعمد `skip` حتى يكتمل ربط المصادقة.

## Troubleshooting

- **Windows + Git**: إلا طلع لك خطأ `schannel: SEC_E_NO_CREDENTIALS` فـ clone/push، استعمل:
  `git -c http.sslBackend=openssl clone <url>`

</div>

---

## English summary

**Dhikra** is a privacy-first personal memory assistant: capture notes, links, quotes and gallery photos; a Darija-speaking RAG chatbot (tRPC → Manus Forge LLM) answers questions about your local memories and extracts dates to schedule notifications. Storage is on-device (expo-sqlite / AsyncStorage); the server only processes AI chat. Stack: Expo 54, React Native 0.81, React 19, expo-router, NativeWind 4, tRPC 11 + Express, Drizzle (MySQL mirror), Vitest.
