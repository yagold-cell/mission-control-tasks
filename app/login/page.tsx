"use client";

import { useState } from "react";
import { CheckCheck, Loader2, Lock } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (res.ok) {
      window.location.href = "/";
    } else {
      setError("הסיסמה לא נכונה, נסה שוב");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center p-4 bg-[radial-gradient(ellipse_at_top,_#e9eaff,_#f5f6fa_60%)]">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl shadow-pop p-8 animate-pop-in">
        <div className="mx-auto mb-5 size-14 rounded-2xl bg-brand text-white grid place-items-center shadow-lg shadow-brand/30">
          <CheckCheck className="size-7" />
        </div>
        <h1 className="text-2xl font-bold text-center">ברוכים הבאים למרחבים</h1>
        <p className="text-muted text-center mt-1 mb-6 text-sm">ניהול משימות חכם, עם עוזר AI אישי</p>
        <label className="block text-sm font-medium mb-1.5" htmlFor="pw">סיסמה</label>
        <div className="relative">
          <Lock className="size-4 absolute top-1/2 -translate-y-1/2 right-3 text-muted" />
          <input
            id="pw"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line pr-9 pl-3 py-2.5 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        <button
          disabled={loading || !password}
          className="mt-5 w-full rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold py-2.5 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          כניסה
        </button>
      </form>
    </main>
  );
}
