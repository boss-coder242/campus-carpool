import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/*
  Tappable public profile card. Reads public_profiles ONLY — never
  users — so no email / phone / gender can leak here. Ride counts come
  from rides (RLS: any signed-in student may read them).

  Usage:  {view && <UserProfile userId={view} onClose={() => setView(null)} />}
*/

function memberSince(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default function UserProfile({ userId, onClose }) {
  const [p, setP] = useState(null);
  const [drove, setDrove] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("public_profiles")
        .select("id, name, branch, year, rating_avg, rating_count, created_at")
        .eq("id", userId).single();
      if (!alive) return;
      if (!data) { setNotFound(true); return; }
      setP(data);

      const { count } = await supabase
        .from("rides")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", userId).eq("status", "completed");
      if (alive) setDrove(count ?? 0);
    })();
    return () => { alive = false; };
  }, [userId]);

  return (
    <div className="up-overlay" onClick={onClose}>
      <div className="up-modal" onClick={(e) => e.stopPropagation()}>
        <style>{css}</style>
        <button className="up-x" onClick={onClose} aria-label="Close">×</button>

        {notFound && <p className="up-dim">Profile unavailable.</p>}
        {!p && !notFound && <p className="up-dim">Loading…</p>}

        {p && (
          <>
            <div className="up-head">
              <div className="up-avatar">{(p.name || "?")[0]?.toUpperCase()}</div>
              <div className="up-id">
                <div className="up-name">{p.name || "Student"}</div>
                <div className="up-dim up-small">
                  {[p.branch, p.year && `Year ${p.year}`].filter(Boolean).join(" · ") || "Chitkara student"}
                </div>
              </div>
            </div>

            <div className="up-stats">
              <div className="up-stat">
                <div className="up-stat-v up-star">
                  {p.rating_count > 0 ? `★ ${Number(p.rating_avg).toFixed(1)}` : "—"}
                </div>
                <div className="up-dim up-small">
                  {p.rating_count > 0 ? `${p.rating_count} rating${p.rating_count > 1 ? "s" : ""}` : "No ratings"}
                </div>
              </div>
              <div className="up-stat">
                <div className="up-stat-v">{drove ?? "…"}</div>
                <div className="up-dim up-small">rides driven</div>
              </div>
              <div className="up-stat">
                <div className="up-stat-v">{memberSince(p.created_at) ?? "—"}</div>
                <div className="up-dim up-small">member since</div>
              </div>
            </div>

            <div className="up-verified">
              <span className="up-check">✓</span> Verified Chitkara student email
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const css = `
.up-overlay{position:fixed;inset:0;background:rgba(4,8,6,.72);display:grid;place-items:center;
  padding:20px;z-index:60;font-family:'Inter',system-ui,sans-serif}
.up-modal{position:relative;background:#16201b;border:1px solid #24332b;border-radius:16px;
  padding:24px;width:100%;max-width:400px;color:#e8efe9}
.up-x{position:absolute;top:12px;right:14px;background:none;border:0;color:#6d7f74;
  font-size:24px;line-height:1;cursor:pointer;padding:2px 6px}
.up-x:hover{color:#e8efe9}
.up-dim{color:#93a69a}
.up-small{font-size:12px}
.up-head{display:flex;align-items:center;gap:14px}
.up-avatar{width:56px;height:56px;border-radius:50%;background:#24382c;color:#9fd8b4;
  display:grid;place-items:center;font-weight:650;font-size:24px;flex:none}
.up-name{font-size:19px;font-weight:650;letter-spacing:-.01em}
.up-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:20px;
  padding-top:18px;border-top:1px solid #24332b;text-align:center}
.up-stat-v{font-size:16px;font-weight:650;margin-bottom:3px}
.up-star{color:#f2c14e}
.up-verified{display:flex;align-items:center;gap:8px;margin-top:18px;padding-top:16px;
  border-top:1px solid #24332b;font-size:13px;color:#9fd8b4}
.up-check{background:#12301f;border:1px solid #2e4a38;border-radius:50%;width:20px;height:20px;
  display:grid;place-items:center;font-size:12px;flex:none}
`;
