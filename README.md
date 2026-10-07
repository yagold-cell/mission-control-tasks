# מרחבים - ניהול משימות חכם עם סוכן AI

מערכת אישית לניהול משימות בעברית (RTL), עם מרחבים, שלוש תצוגות (קנבן, רשימה, לוח שנה), דשבורד, וסוכן AI מובנה.

## טכנולוגיה
- Next.js 16 (App Router) + Tailwind CSS 4
- Postgres (`postgres` driver) - הטבלאות נוצרות אוטומטית
- OpenAI API (`gpt-6-luna`) עם 5 כלים: read / add / update / delete / summarize
- dnd-kit לגרירה בקנבן

## משתני סביבה
ראו `.env.example`: `DATABASE_URL`, `OPENAI_API_KEY`, `APP_PASSWORD` (ואופציונלי `OPENAI_MODEL`).

## הרצה
```bash
npm install
npm run db:seed   # יוצר טבלאות + נתוני דוגמה (רק אם המסד ריק)
npm run dev
```
