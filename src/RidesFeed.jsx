import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { CAMPUS_LOCATIONS } from "./locations";

export default function RidesFeed() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(null);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [isFemale, setIsFemale] = useState(false);
  const [femaleFilter, setFemaleFilter] = useState(false);
  const [filter, setFilter] = useState({ from: "", to: "", date: "" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: me } = await supabase.from("users").select("gender").eq("id", uid).single();
        setIsFemale(me?.gender === "female");
      }
    })();
    loadRides();
    loadMyseats();
  }, []);

  // ---- snippet #1 lives here ----
  async function loadRides() {
    setLoading(true);
    const { data, error } = await supabase
      .from("rides")
      .select(`
        id, from, to, date, time, seats_left, seats_total, price, note, status, women_only,
        driver:public_profiles!driver_id (id, name, branch, year, rating_avg, rating_count)
      `)
      .eq("status", "open")
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date")
      .order("time");

    setLoading(false);
    if (error) { setMessage(error.message); return; }
    setRides(data ?? []);
  }

  // which rides am I already on?
  async function loadMyseats() {
    const { data } = await supabase
      .from("ride_passengers")
      .select("ride_id")
      .is("left_at", null);
    setJoinedIds(new Set((data ?? []).map((r) => r.ride_id)));
  }

  // ---- snippet #2 lives here ----
  async function joinRide(rideId) {
    setMessage("");
    setJoiningId(rideId);
    const { error } = await supabase.rpc("join_ride", { p_ride_id: rideId });
    setJoiningId(null);
    if (error) { setMessage(error.message); return; }
    setMessage("Seat booked. Check your rides for the driver's number.");
    loadRides();
    loadMyseats();
  }

  async function leaveRide(rideId) {
    setMessage("");
    setJoiningId(rideId);
    const { error } = await supabase.rpc("leave_ride", { p_ride_id: rideId });
    setJoiningId(null);
    if (error) { setMessage(error.message); return; }
    setMessage("You left the ride. Seat is back up for grabs.");
    loadRides();
    loadMyseats();
  }

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

  const q = (s) => s.trim().toLowerCase();
  const activeFilters = filter.from || filter.to || filter.date || femaleFilter;
  const shown = rides.filter((r) => {
    if (femaleFilter && !r.women_only) return false;
    if (filter.from && !r.from.toLowerCase().includes(q(filter.from))) return false;
    if (filter.to && !r.to.toLowerCase().includes(q(filter.to))) return false;
    if (filter.date && r.date !== filter.date) return false;
    return true;
  });

  const clearFilters = () => setFilter({ from: "", to: "", date: "" });

  return (
    <div className="rf-wrap">
      <style>{css}</style>
      <datalist id="rf-locs">
        {CAMPUS_LOCATIONS.map((l) => <option key={l} value={l} />)}
      </datalist>

      <header className="rf-head">
        <h1>Rides leaving soon</h1>
        <button className="rf-refresh" onClick={loadRides}>Refresh</button>
      </header>

      <div className="rf-search">
        <div className="rf-search-row">
          <input list="rf-locs" placeholder="From" value={filter.from}
            onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
          <span className="rf-search-arrow">→</span>
          <input list="rf-locs" placeholder="To" value={filter.to}
            onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
        </div>
        <div className="rf-search-row">
          <input type="date" min={new Date().toISOString().slice(0, 10)} value={filter.date}
            onChange={(e) => setFilter({ ...filter, date: e.target.value })} />
          {(filter.from || filter.to || filter.date) &&
            <button className="rf-clear" onClick={clearFilters}>Clear</button>}
        </div>
      </div>

      {isFemale && (
        <button className={`rf-filter ${femaleFilter ? "on" : ""}`}
          onClick={() => setFemaleFilter((v) => !v)}>
          ♀ Women-only rides {femaleFilter ? "· on" : ""}
        </button>
      )}

      {message && <p className="rf-msg" role="status">{message}</p>}

      {loading && <p className="rf-dim">Loading rides…</p>}

      {!loading && shown.length === 0 && (
        <div className="rf-empty">
          <p>{activeFilters ? "No rides match your search." : "No rides posted yet."}</p>
          <p className="rf-dim">
            {activeFilters ? "Try widening the route or date." : "Be the first — post one and fill your empty seats."}
          </p>
        </div>
      )}

      <ul className="rf-list">
        {shown.map((r) => {
          const mine = r.driver?.id === userId;
          const joined = joinedIds.has(r.id);
          return (
            <li key={r.id} className="rf-card">
              <div className="rf-route">
                <span className="rf-place">{r.from}</span>
                <span className="rf-arrow">→</span>
                <span className="rf-place">{r.to}</span>
              </div>

              <div className="rf-when">
                {fmtDate(r.date)} · {fmtTime(r.time)}
                {r.women_only && <span className="rf-wo">♀ Women only</span>}
              </div>

              {r.note && <p className="rf-note">{r.note}</p>}

              <div className="rf-foot">
                <div className="rf-driver">
                  <span className="rf-avatar">{r.driver?.name?.[0] ?? "?"}</span>
                  <div>
                    <div className="rf-name">{r.driver?.name ?? "Student"}</div>
                    <div className="rf-dim rf-small">
                      {r.driver?.branch} · Year {r.driver?.year}
                      {r.driver?.rating_count > 0 &&
                        ` · ★ ${Number(r.driver.rating_avg).toFixed(1)}`}
                    </div>
                  </div>
                </div>

                <div className="rf-actions">
                  <div className="rf-price">₹{Number(r.price).toFixed(0)}</div>
                  <div className="rf-seats">{r.seats_left} of {r.seats_total} seats</div>
                  {mine ? (
                    <span className="rf-tag">Your ride</span>
                  ) : joined ? (
                    <button className="rf-btn ghost" disabled={joiningId === r.id}
                      onClick={() => leaveRide(r.id)}>
                      {joiningId === r.id ? "…" : "Leave"}
                    </button>
                  ) : (r.women_only && !isFemale) ? (
                    <span className="rf-tag">Women only</span>
                  ) : (
                    <button className="rf-btn" disabled={joiningId === r.id}
                      onClick={() => joinRide(r.id)}>
                      {joiningId === r.id ? "Booking…" : "Take a seat"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const css = `
.rf-wrap{max-width:640px;margin:0 auto;padding:28px 20px 60px;
  font-family:'Inter',system-ui,sans-serif;color:#e8efe9}
.rf-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.rf-head h1{font-size:22px;font-weight:650;margin:0;letter-spacing:-.01em}
.rf-refresh{background:none;border:1px solid #2b3d33;color:#9fd8b4;border-radius:8px;
  padding:7px 12px;font-size:13px;cursor:pointer}
.rf-msg{background:#1a2a20;border:1px solid #2e4a38;color:#c9e8d4;
  border-radius:10px;padding:11px 14px;font-size:13.5px;margin:0 0 16px}
.rf-dim{color:#93a69a}
.rf-search{background:#16201b;border:1px solid #24332b;border-radius:14px;
  padding:12px;margin:0 0 14px;display:flex;flex-direction:column;gap:10px}
.rf-search-row{display:flex;align-items:center;gap:8px}
.rf-search input{flex:1;min-width:0;box-sizing:border-box;background:#0e1512;color:#e8efe9;
  border:1px solid #2b3d33;border-radius:9px;padding:10px 12px;font-size:14px;outline:none}
.rf-search input:focus{border-color:#5fd08a;box-shadow:0 0 0 3px rgba(95,208,138,.15)}
.rf-search-arrow{color:#5fd08a;flex:none}
.rf-clear{background:none;border:1px solid #2b3d33;color:#93a69a;border-radius:9px;
  padding:9px 14px;font-size:13px;cursor:pointer;flex:none}
.rf-filter{background:none;border:1px solid #4a3a52;color:#c48fd0;border-radius:20px;
  padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;margin:0 0 16px}
.rf-filter.on{background:#2a1f30;border-color:#c48fd0}
.rf-wo{display:inline-block;margin-left:8px;font-size:11px;font-weight:600;color:#d9a7e3;
  background:#2a1f30;border:1px solid #4a3a52;border-radius:20px;padding:2px 8px}
.rf-small{font-size:12px}
.rf-empty{border:1px dashed #2b3d33;border-radius:14px;padding:36px 20px;text-align:center}
.rf-empty p{margin:0 0 6px}
.rf-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px}
.rf-card{background:#16201b;border:1px solid #24332b;border-radius:14px;padding:18px}
.rf-route{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:600}
.rf-arrow{color:#5fd08a}
.rf-when{color:#93a69a;font-size:13px;margin-top:5px}
.rf-note{font-size:13.5px;color:#c2d2c8;margin:10px 0 0;line-height:1.45}
.rf-foot{display:flex;justify-content:space-between;align-items:flex-end;
  margin-top:16px;padding-top:14px;border-top:1px solid #24332b;gap:12px}
.rf-driver{display:flex;align-items:center;gap:10px;min-width:0}
.rf-avatar{width:34px;height:34px;border-radius:50%;background:#24382c;color:#9fd8b4;
  display:grid;place-items:center;font-weight:650;flex:none}
.rf-name{font-size:14px;font-weight:550}
.rf-actions{text-align:right;flex:none}
.rf-price{font-size:17px;font-weight:650;color:#5fd08a}
.rf-seats{font-size:12px;color:#93a69a;margin-bottom:8px}
.rf-btn{background:#5fd08a;color:#0b120e;border:0;border-radius:9px;
  padding:9px 15px;font-size:13.5px;font-weight:650;cursor:pointer}
.rf-btn.ghost{background:none;border:1px solid #2b3d33;color:#93a69a}
.rf-btn:disabled{opacity:.55;cursor:default}
.rf-tag{font-size:12px;color:#93a69a;border:1px solid #2b3d33;
  border-radius:6px;padding:5px 9px;display:inline-block}
@media(max-width:480px){.rf-foot{flex-direction:column;align-items:stretch}
.rf-actions{text-align:left}}
`;
