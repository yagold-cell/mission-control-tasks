"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Loader2, Trash2 } from "lucide-react";
import { Modal, btn } from "./ui";
import { useApp } from "./AppShell";
import { VIEW_ICON } from "./Sidebar";
import { SPACE_COLORS, VIEWS, VIEW_META } from "@/lib/constants";
import { createSpace, deleteSpace, updateSpace } from "@/lib/client";
import type { Space, ViewType } from "@/lib/types";

export function SpaceDialog({ space, onClose }: { space?: Space; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useApp();
  const [name, setName] = useState(space?.name ?? "");
  const [color, setColor] = useState(space?.color ?? SPACE_COLORS[0]);
  const [view, setView] = useState<ViewType>(space?.view ?? "kanban");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (space) {
        await updateSpace(space.id, { name: name.trim(), color, view });
        toast("המרחב עודכן");
      } else {
        const created = await createSpace({ name: name.trim(), color, view });
        toast("המרחב נוצר");
        router.push(`/spaces/${created.id}`);
      }
      onClose();
    } catch {
      toast("השמירה נכשלה");
      setSaving(false);
    }
  }

  async function remove() {
    if (!space) return;
    setSaving(true);
    await deleteSpace(space.id);
    toast("המרחב נמחק");
    onClose();
    router.push("/");
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={space ? "הגדרות מרחב" : "מרחב חדש"}
      footer={
        <>
          <button className={btn.primary} onClick={save} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {space ? "שמירה" : "יצירת מרחב"}
          </button>
          <button className={btn.ghost} onClick={onClose}>ביטול</button>
          <div className="flex-1" />
          {space &&
            (confirmDelete ? (
              <div className="flex items-center gap-1 animate-fade-in">
                <span className="text-xs text-muted">כל המשימות יימחקו</span>
                <button className={clsx(btn.danger, "bg-red-50")} onClick={remove}>מחיקה</button>
                <button className={btn.ghost} onClick={() => setConfirmDelete(false)}>לא</button>
              </div>
            ) : (
              <button className={btn.danger} onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
                מחיקת מרחב
              </button>
            ))}
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="text-xs font-semibold text-muted mb-2">שם המרחב</div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="למשל: בית, עבודה, לימודים"
            className="w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-muted mb-2">צבע</div>
          <div className="flex flex-wrap gap-2">
            {SPACE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="size-8 rounded-full grid place-items-center transition hover:scale-110"
                style={{ background: c, boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined }}
                aria-label={c}
              >
                {color === c && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted mb-2">תצוגה</div>
          <div className="grid grid-cols-3 gap-2">
            {VIEWS.map((v) => {
              const Icon = VIEW_ICON[v];
              const active = view === v;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={clsx(
                    "rounded-2xl border-2 p-3 text-right transition",
                    active ? "bg-white shadow-sm" : "border-line bg-slate-50/60 hover:bg-white",
                  )}
                  style={active ? { borderColor: color } : undefined}
                >
                  <Icon className="size-5 mb-2" style={{ color: active ? color : "#94a3b8" }} />
                  <div className="text-sm font-semibold">{VIEW_META[v].label}</div>
                  <div className="text-[11px] text-muted leading-4 mt-0.5">{VIEW_META[v].description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
