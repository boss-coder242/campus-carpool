import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import UserProfile from "./UserProfile";

/*
  My Rides — two lenses on the same person:
    • Driving  : rides I posted (cancel / mark completed / see passengers / rate them)
    • Riding   : rides I joined  (leave / rate the driver)
  Ratings only unlock once a ride is 'completed'. Report is available anywhere.
*/

function fmtTime(t) {
  const [h, m] = t.split(":");
  const hr = Number(h);
  return `${((hr + 11) % 12) + 1}:${m} ${hr < 12 ? "am" : "pm"}`;
}
function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
}

const STATUS_LABEL = { open: "Open", full: "Full", completed: "Completed", cancelled: "Cancelled" };

function Stars({ onRate, busy }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="mr-stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={busy} className="mr-star"
          onMouseEnter={() => setHover(n)} onClick={() => onRate(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}>
          <span className={n <= hover ? "on" : ""}>★</span>
        </button>
      ))}
    </div>
  );
}

function ContactPanel({ people, busy }) {
  if (busy) return <p className="mr-dim mr-small">Loading contact…</p>;
  if (!people || people.length === 0) return <p className="mr-dim mr-small">No one to contact yet.</p>;
  return (
    <div className="mr-contacts">
      {people.map((p) => (
        <div key={p.id} className="mr-contact">
          <div>
            <div className="mr-name">{p.name || "Student"}</div>
            <div className="mr-dim mr-small">{p.phone ? `+91 ${p.phone}` : "No number on file"}</div>
          </div>
          {p.phone && (
            <div className="mr-contact-btns">
              <a className="mr-cbtn" href={`tel:+91${p.phone}`}>Call</a>
              <a className="mr-cbtn wa" href={`https://wa.me/91${p.phone}`}
                target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function MyRides() {
  const [me, setMe] = useState(null);
  const [driving, setDriving] = useState([]);
  const [riding, setRiding] = useState([]);
  const [pax, setPax] = useState({});        // rideId -> [{user_id, left_at}]
  const [profiles, setProfiles] = useState({}); // id -> profile
  const [rated, setRated] = useState(new Set()); // `${rideId}|${ratedId}`
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState("");
  const [report, setReport] = useState(null); // { id, name, rideId }
  const [contacts, setContacts] = useState({}); // rideId -> [{id,name,phone,role}]
  const [openC, setOpenC] = useState(new Set()); // rideIds with contacts revealed
  const [viewUser, setViewUser] = useState(null);

  useEffect(() => { load(); }, []);

  async function toggleContacts(rideId) {
    setMessage("");
    const next = new Set(openC);
    if (next.has(rideId)) { next.delete(rideId); setOpenC(next); return; }
    if (!contacts[rideId]) {
      setBusyKey("contact" + rideId);
      const { data, error } = await supabase.rpc("get_ride_contacts", { p_ride_id: rideId });
      setBusyKey(null);
      if (error) { setMessage(error.message); return; }
      setContacts((c) => ({ ...c, [rideId]: data ?? [] }));
    }
    next.add(rideId); setOpenC(next);
  }

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setMe(uid);

    const [drv, rid] = await Promise.all([
      supabase.from("rides").select("*").eq("driver_id", uid).order("date", { ascending: false }),
      supabase.from("ride_passengers")
        .select("ride_id, left_at, ride:rides(*)")
        .eq("user_id", uid)
        .order("joined_at", { ascending: false }),
    ]);

    const drvRides = drv.data ?? [];
    const ridRows = (rid.data ?? []).filter((r) => r.ride);
    setDriving(drvRides);
    setRiding(ridRows);

    // passengers of my rides
    const drivingIds = drvRides.map((r) => r.id);
    const paxMap = {};
    const needIds = new Set();
    if (drivingIds.length) {
      const { data: pax } = await supabase
        .from("ride_passengers").select("ride_id, user_id, left_at").in("ride_id", drivingIds);
      (pax ?? []).forEach((p) => {
        (paxMap[p.ride_id] ??= []).push(p);
        needIds.add(p.user_id);
      });
    }
    setPax(paxMap);

    // driver names for rides I'm riding
    ridRows.forEach((r) => needIds.add(r.ride.driver_id));

    // profiles
    const ids = [...needIds];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("public_profiles").select("id, name, branch, year, rating_avg, rating_count").in("id", ids);
      const pm = {};
      (profs ?? []).forEach((p) => { pm[p.id] = p; });
      setProfiles(pm);
    }

    // what I've already rated
    const { data: myRatings } = await supabase
      .from("ratings").select("ride_id, rated_id").eq("rater_id", uid);
    setRated(new Set((myRatings ?? []).map((r) => `${r.ride_id}|${r.rated_id}`)));

    setLoading(false);
  }

  async function markCompleted(id) {
    setMessage(""); setBusyKey("done" + id);
    const { error } = await supabase.from("rides").update({ status: "completed" }).eq("id", id);
    setBusyKey(null);
    if (error) return setMessage(error.message);
    setMessage("Ride marked completed. You can rate your passengers now.");
    load();
  }

  async function cancelRide(id) {
    if (!window.confirm("Cancel this ride? Passengers who joined will see it as cancelled.")) return;
    setMessage(""); setBusyKey("cancel" + id);
    const { error } = await supabase.from("rides").update({ status: "cancelled" }).eq("id", id);
    setBusyKey(null);
    if (error) return setMessage(error.message);
    load();
  }

  async function leaveRide(id) {
    setMessage(""); setBusyKey("leave" + id);
    const { error } = await supabase.rpc("leave_ride", { p_ride_id: id });
    setBusyKey(null);
    if (error) return setMessage(error.message);
    setMessage("You left the ride.");
    load();
  }

  async function rate(rideId, ratedId, stars) {
    setMessage(""); setBusyKey("rate" + rideId + ratedId);
    const { error } = await supabase.rpc("rate_user", {
      p_ride_id: rideId, p_rated_id: ratedId, p_stars: stars,
    });
    setBusyKey(null);
    if (error) return setMessage(error.message);
    setMessage("Thanks — rating saved.");
    load();
  }

  async function submitReport(reason) {
    const r = report;
    setBusyKey("report");
    const { error } = await supabase.from("reports").insert({
      reporter_id: me, reported_id: r.id, ride_id: r.rideId ?? null, reason,
    });
    setBusyKey(null);
    setReport(null);
    setMessage(error ? error.message : "Report submitted. Thanks for flagging it.");
  }

  const name = (id) => profiles[id]?.name ?? "Student";
  const meta = (id) => {
    const p = profiles[id];
    if (!p) return "";
    const r = p.rating_count > 0 ? ` · ★ ${Number(p.rating_avg).toFixed(1)}` : "";
    return `${p.branch ?? ""}${p.year ? " · Year " + p.year : ""}${r}`;
  };

  if (loading) return <div className="mr-wrap"><style>{css}</style><p className="mr-dim">Loading your rides…</p></div>;

  return (
    <div className="mr-wrap">
      <style>{css}</style>
      <h1>My rides</h1>
      {message && <p className="mr-msg" role="status">{message}</p>}

      {/* ---------- DRIVING ---------- */}
      <h2 className="mr-section">Driving</h2>
      {driving.length === 0 && <p className="mr-dim mr-empty">You haven't posted any rides yet.</p>}
      <ul className="mr-list">
        {driving.map((r) => {
          const list = (pax[r.id] ?? []);
          const active = list.filter((p) => !p.left_at);
          return (
            <li key={r.id} className="mr-card">
              <div className="mr-top">
                <div className="mr-route">{r.from} <span className="mr-arrow">→</span> {r.to}</div>
                <span className={`mr-badge s-${r.status}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div className="mr-when">{fmtDate(r.date)} · {fmtTime(r.time)} · {r.seats_left}/{r.seats_total} left · ₹{Number(r.price).toFixed(0)}
                {r.women_only && <span className="mr-wo">♀ Women only</span>}</div>

              {(r.status === "open" || r.status === "full") && (
                <>
                  <div className="mr-pax">
                    {active.length === 0 ? <span className="mr-dim">No passengers yet.</span>
                      : active.map((p) => (
                        <button key={p.user_id} className="mr-chip" title="View profile"
                          onClick={() => setViewUser(p.user_id)}>{name(p.user_id)}</button>
                      ))}
                  </div>
                  <div className="mr-actions">
                    <button className="mr-btn" disabled={busyKey === "done" + r.id}
                      onClick={() => markCompleted(r.id)}>Mark completed</button>
                    <button className="mr-btn ghost" disabled={busyKey === "cancel" + r.id}
                      onClick={() => cancelRide(r.id)}>Cancel</button>
                  </div>
                </>
              )}

              {r.status === "completed" && (
                <div className="mr-rate-block">
                  {list.length === 0 ? <span className="mr-dim">No passengers on this ride.</span> :
                    list.map((p) => {
                      const done = rated.has(`${r.id}|${p.user_id}`);
                      return (
                        <div key={p.user_id} className="mr-rate-row">
                          <button className="mr-person" onClick={() => setViewUser(p.user_id)} title="View profile">
                            <div className="mr-name">{name(p.user_id)}</div>
                            <div className="mr-dim mr-small">{meta(p.user_id)}</div>
                          </button>
                          {done ? <span className="mr-tag">Rated</span>
                            : <Stars busy={busyKey === "rate" + r.id + p.user_id}
                                onRate={(s) => rate(r.id, p.user_id, s)} />}
                        </div>
                      );
                    })}
                </div>
              )}

              {r.status !== "cancelled" && (r.status === "completed" ? list.length : active.length) > 0 && (
                <div className="mr-contact-wrap">
                  <button className="mr-link" disabled={busyKey === "contact" + r.id}
                    onClick={() => toggleContacts(r.id)}>
                    {openC.has(r.id) ? "Hide passenger contacts" : "Show passenger contacts"}
                  </button>
                  {openC.has(r.id) &&
                    <ContactPanel people={contacts[r.id]} busy={busyKey === "contact" + r.id} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* ---------- RIDING ---------- */}
      <h2 className="mr-section">Riding</h2>
      {riding.length === 0 && <p className="mr-dim mr-empty">You haven't joined any rides yet.</p>}
      <ul className="mr-list">
        {riding.map((row) => {
          const r = row.ride;
          const drv = r.driver_id;
          const left = !!row.left_at;
          const done = rated.has(`${r.id}|${drv}`);
          return (
            <li key={r.id + row.ride_id} className="mr-card">
              <div className="mr-top">
                <div className="mr-route">{r.from} <span className="mr-arrow">→</span> {r.to}</div>
                <span className={`mr-badge s-${left ? "cancelled" : r.status}`}>
                  {left ? "Left" : STATUS_LABEL[r.status]}
                </span>
              </div>
              <div className="mr-when">{fmtDate(r.date)} · {fmtTime(r.time)} · ₹{Number(r.price).toFixed(0)}
                {r.women_only && <span className="mr-wo">♀ Women only</span>}</div>

              {(r.car_model || r.car_color) && (
                <div className="mr-car">🚗 {[r.car_model, r.car_color].filter(Boolean).join(" · ")}</div>
              )}

              <div className="mr-rate-row">
                <button className="mr-person" onClick={() => setViewUser(drv)} title="View profile">
                  <div className="mr-name">{name(drv)}</div>
                  <div className="mr-dim mr-small">{meta(drv)} · driver</div>
                </button>
                <div className="mr-inline-actions">
                  {!left && (r.status === "open" || r.status === "full") && (
                    <button className="mr-btn ghost sm" disabled={busyKey === "leave" + r.id}
                      onClick={() => leaveRide(r.id)}>Leave</button>
                  )}
                  {r.status === "completed" && !left && (
                    done ? <span className="mr-tag">Rated</span>
                      : <Stars busy={busyKey === "rate" + r.id + drv} onRate={(s) => rate(r.id, drv, s)} />
                  )}
                  <button className="mr-link" onClick={() => setReport({ id: drv, name: name(drv), rideId: r.id })}>
                    Report
                  </button>
                </div>
              </div>

              {!left && r.status !== "cancelled" && (
                <div className="mr-contact-wrap">
                  <button className="mr-link" disabled={busyKey === "contact" + r.id}
                    onClick={() => toggleContacts(r.id)}>
                    {openC.has(r.id) ? "Hide driver contact" : "Contact driver"}
                  </button>
                  {openC.has(r.id) &&
                    <ContactPanel people={contacts[r.id]} busy={busyKey === "contact" + r.id} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {report && (
        <ReportModal name={report.name} busy={busyKey === "report"}
          onClose={() => setReport(null)} onSubmit={submitReport} />
      )}

      {viewUser && <UserProfile userId={viewUser} onClose={() => setViewUser(null)} />}
    </div>
  );
}

function ReportModal({ name, onClose, onSubmit, busy }) {
  const [reason, setReason] = useState("");
  return (
    <div className="mr-overlay" onClick={onClose}>
      <div className="mr-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Report {name}</h3>
        <p className="mr-dim mr-small">Tell us what happened. Reports are private and reviewed by admins.</p>
        <textarea rows={4} autoFocus placeholder="No-show, unsafe driving, harassment…"
          value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mr-actions">
          <button className="mr-btn danger" disabled={busy || !reason.trim()}
            onClick={() => onSubmit(reason.trim())}>{busy ? "Submitting…" : "Submit report"}</button>
          <button className="mr-btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const css = `
.mr-wrap{max-width:620px;margin:0 auto;padding:28px 18px 40px}
.mr-wrap h1{font-size:28px;font-weight:700;margin:0 0 14px;letter-spacing:-.03em}
.mr-section{font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;
  letter-spacing:.1em;margin:28px 0 12px}
.mr-msg{background:var(--surface-2);border:1px solid var(--border);
  border-left:3px solid var(--green);color:var(--text);
  border-radius:var(--radius-sm);padding:13px 15px;font-size:13.5px;margin:0 0 10px;line-height:1.45}
.mr-dim{color:var(--text-2)}
.mr-small{font-size:12.5px}
.mr-empty{font-size:13.5px;color:var(--text-2);border:1px dashed var(--border-strong);
  border-radius:var(--radius);padding:28px 20px;text-align:center}
.mr-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px}
.mr-card{background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius);padding:18px;transition:border-color .15s}
.mr-card:hover{border-color:var(--border-strong)}
.mr-top{display:flex;justify-content:space-between;align-items:center;gap:10px}
.mr-route{font-size:17px;font-weight:700;letter-spacing:-.02em}
.mr-arrow{color:var(--text-3);margin:0 2px}
.mr-when{color:var(--text-2);font-size:12.5px;margin-top:6px}
.mr-wo{display:inline-block;margin-left:7px;font-size:10.5px;font-weight:700;
  color:var(--pink);background:var(--pink-dim);border-radius:var(--radius-pill);padding:2px 8px}
.mr-badge{font-size:11px;font-weight:700;padding:4px 10px;
  border-radius:var(--radius-pill);white-space:nowrap}
.s-open{background:var(--green-dim);color:var(--green)}
.s-full{background:var(--amber-dim);color:var(--amber)}
.s-completed{background:var(--blue-dim);color:var(--blue)}
.s-cancelled{background:var(--red-dim);color:var(--red)}
.mr-pax{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}
.mr-chip{font-size:12.5px;background:var(--surface-2);border:1px solid var(--border);
  color:var(--text-2);border-radius:var(--radius-pill);padding:6px 12px;cursor:pointer;
  font-family:inherit;font-weight:500}
.mr-chip:hover{border-color:var(--border-strong);color:var(--text)}
.mr-person{background:none;border:0;padding:0;text-align:left;cursor:pointer;
  color:inherit;font:inherit;min-width:0}
.mr-person:hover .mr-name{text-decoration:underline}
.mr-car{margin-top:10px;font-size:12.5px;color:var(--text-2)}
.mr-actions{display:flex;gap:8px;margin-top:16px}
.mr-inline-actions{display:flex;align-items:center;gap:10px}
.mr-btn{background:var(--accent);color:var(--accent-fg);border:0;border-radius:var(--radius-sm);
  padding:11px 17px;font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;
  transition:transform .1s,opacity .15s}
.mr-btn:active:not(:disabled){transform:scale(.97)}
.mr-btn.ghost{background:transparent;border:1px solid var(--border-strong);color:var(--text)}
.mr-btn.ghost:hover:not(:disabled){background:var(--surface-2)}
.mr-btn.danger{background:var(--red);color:#1a0c0c}
.mr-btn.sm{padding:9px 14px;font-size:12.5px}
.mr-btn:disabled{opacity:.4;cursor:default}
.mr-link{background:none;border:0;color:var(--text-2);font-size:12.5px;font-family:inherit;
  cursor:pointer;padding:0;text-decoration:underline;text-underline-offset:3px}
.mr-link:hover:not(:disabled){color:var(--text)}
.mr-rate-block{margin-top:14px;padding-top:14px;border-top:1px solid var(--border);
  display:flex;flex-direction:column;gap:10px}
.mr-rate-row{display:flex;justify-content:space-between;align-items:center;gap:12px;
  margin-top:14px;padding-top:14px;border-top:1px solid var(--border)}
.mr-name{font-size:14.5px;font-weight:600}
.mr-tag{font-size:12px;color:var(--text-2);background:var(--surface-2);
  border-radius:var(--radius-pill);padding:5px 11px}
.mr-contact-wrap{margin-top:14px;padding-top:14px;border-top:1px solid var(--border)}
.mr-contacts{display:flex;flex-direction:column;gap:9px;margin-top:12px}
.mr-contact{display:flex;justify-content:space-between;align-items:center;gap:12px;
  background:var(--surface-2);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:12px 14px}
.mr-contact-btns{display:flex;gap:8px;flex:none}
.mr-cbtn{background:var(--surface-3);border:1px solid var(--border-strong);color:var(--text);
  border-radius:9px;padding:9px 14px;font-size:12.5px;font-weight:700;
  text-decoration:none;white-space:nowrap;transition:background .15s}
.mr-cbtn:hover{background:var(--border-strong)}
.mr-cbtn.wa{background:var(--green);border-color:var(--green);color:#08210f}
.mr-cbtn.wa:hover{opacity:.9}
.mr-stars{display:flex;gap:3px}
.mr-star{background:none;border:0;cursor:pointer;padding:2px;font-size:21px;line-height:1;
  color:var(--surface-3);transition:color .12s}
.mr-star .on{color:var(--amber)}
.mr-star:disabled{cursor:default}
.mr-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);
  display:grid;place-items:center;padding:20px;z-index:50}
.mr-modal{background:var(--surface);border:1px solid var(--border);border-radius:20px;
  padding:24px;width:100%;max-width:420px;box-shadow:var(--shadow)}
.mr-modal h3{margin:0 0 6px;font-size:18px;font-weight:700;letter-spacing:-.02em}
.mr-modal textarea{margin-top:14px;font-size:14px}
@media(max-width:420px){.mr-wrap{padding:22px 14px 34px}.mr-wrap h1{font-size:24px}}
`;
