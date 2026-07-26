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
  const [reviews, setReviews] = useState([]);
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

      // written reviews (public_reviews exposes rater name only)
      const { data: revs } = await supabase
        .from("public_reviews")
        .select("id, stars, comment, created_at, rater_name")
        .eq("rated_id", userId)
        .not("comment", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (alive) setReviews(revs ?? []);
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

            {reviews.length > 0 && (
              <div className="up-reviews">
                <div className="up-rev-h">Reviews</div>
                {reviews.map((rv) => (
                  <div key={rv.id} className="up-rev">
                    <div className="up-rev-top">
                      <span className="up-rev-stars">{"★".repeat(rv.stars)}<span className="up-rev-off">{"★".repeat(5 - rv.stars)}</span></span>
                      <span className="up-dim up-small">{rv.rater_name ?? "Student"}</span>
                    </div>
                    <p className="up-rev-body">{rv.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const css = `
.up-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);
  display:grid;place-items:center;padding:20px;z-index:60;animation:upFade .15s ease}
.up-modal{position:relative;background:var(--surface);border:1px solid var(--border);
  border-radius:20px;padding:26px;width:100%;max-width:400px;color:var(--text);
  box-shadow:var(--shadow);animation:upPop .18s ease}
@keyframes upFade{from{opacity:0}to{opacity:1}}
@keyframes upPop{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}
.up-x{position:absolute;top:14px;right:16px;background:none;border:0;color:var(--text-3);
  font-size:26px;line-height:1;cursor:pointer;padding:2px 6px}
.up-x:hover{color:var(--text)}
.up-dim{color:var(--text-2)}
.up-small{font-size:12.5px}
.up-head{display:flex;align-items:center;gap:15px}
.up-avatar{width:62px;height:62px;border-radius:50%;background:var(--surface-3);
  color:var(--text);display:grid;place-items:center;font-weight:700;font-size:26px;flex:none}
.up-name{font-size:20px;font-weight:700;letter-spacing:-.03em}
.up-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:22px;
  padding-top:20px;border-top:1px solid var(--border);text-align:center}
.up-stat-v{font-size:17px;font-weight:700;margin-bottom:4px;letter-spacing:-.02em}
.up-star{color:var(--amber)}
.up-verified{display:flex;align-items:center;gap:9px;margin-top:20px;padding-top:18px;
  border-top:1px solid var(--border);font-size:13px;color:var(--text-2)}
.up-check{background:var(--green-dim);color:var(--green);border-radius:50%;
  width:21px;height:21px;display:grid;place-items:center;font-size:12px;font-weight:700;flex:none}
.up-reviews{margin-top:20px;padding-top:18px;border-top:1px solid var(--border);
  max-height:230px;overflow-y:auto}
.up-rev-h{font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;
  letter-spacing:.1em;margin-bottom:12px}
.up-rev{padding:11px 0;border-bottom:1px solid var(--border)}
.up-rev:last-child{border-bottom:0;padding-bottom:0}
.up-rev-top{display:flex;align-items:center;gap:9px;margin-bottom:5px}
.up-rev-stars{color:var(--amber);font-size:12px;letter-spacing:1px}
.up-rev-off{color:var(--surface-3)}
.up-rev-body{margin:0;font-size:13.5px;line-height:1.5;color:var(--text-2)}
`;
