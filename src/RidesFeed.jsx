import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { CAMPUS_LOCATIONS } from "./locations";
import UserProfile from "./UserProfile";

export default function RidesFeed({ onOffer }) {
  const [view, setView] = useState("rides"); // rides | requests
  const [requests, setRequests] = useState([]);
  const [riders, setRiders] = useState({});  // id -> public profile
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(null);
  const [joinedIds, setJoinedIds] = useState(new Set());
  const [isFemale, setIsFemale] = useState(false);
  const [femaleFilter, setFemaleFilter] = useState(false);
  const [filter, setFilter] = useState({ from: "", to: "", date: "", passengers: 1 });
  const [sort, setSort] = useState("soonest");
  const [viewUser, setViewUser] = useState(null);
  // Rides offered are search-first: nothing shows until you hit Search.
  const [searched, setSearched] = useState(false);

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
    loadRequests();
  }, []);

  // Riders are fetched separately rather than embedded — PostgREST can't
  // always infer the FK through the public_profiles view (see CLAUDE.md).
  async function loadRequests() {
    const { data, error } = await supabase
      .from("ride_requests")
      .select("id, rider_id, from, to, date, time, seats_needed, note, status")
      .eq("status", "open")
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date").order("time", { nullsFirst: true });
    if (error) { setMessage(error.message); return; }
    const rows = data ?? [];
    setRequests(rows);

    const ids = [...new Set(rows.map((r) => r.rider_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("public_profiles")
        .select("id, name, branch, year, rating_avg, rating_count").in("id", ids);
      const m = {};
      (profs ?? []).forEach((p) => { m[p.id] = p; });
      setRiders(m);
    }
  }

  async function cancelRequest(id) {
    setMessage("");
    const { error } = await supabase
      .from("ride_requests").update({ status: "cancelled" }).eq("id", id);
    if (error) { setMessage(error.message); return; }
    setMessage("Request cancelled.");
    loadRequests();
  }

  async function loadRides() {
    setLoading(true);
    const { data, error } = await supabase
      .from("rides")
      .select(`
        id, from, to, date, time, seats_left, seats_total, price, note, status, women_only,
        car_model, car_color, instant_book,
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

  async function joinRide(rideId) {
    setMessage("");
    setJoiningId(rideId);
    const { error } = await supabase.rpc("join_ride", { p_ride_id: rideId });
    setJoiningId(null);
    if (error) { setMessage(error.message); return; }
    const r = rides.find((x) => x.id === rideId);
    setMessage(r && r.instant_book === false
      ? "Request sent. You'll hold the seat until the driver replies."
      : "Seat booked. Check My Rides for the driver's number.");
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
    const today = new Date().toISOString().slice(0, 10);
    const tmr = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    if (d === today) return "Today";
    if (d === tmr) return "Tomorrow";
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short",
    });
  }

  const q = (s) => s.trim().toLowerCase();
  const activeFilters = filter.from || filter.to || filter.date || filter.passengers > 1 || femaleFilter;

  const SORTS = {
    soonest: (a, b) => (a.date + a.time).localeCompare(b.date + b.time),
    cheapest: (a, b) => Number(a.price) - Number(b.price) || (a.date + a.time).localeCompare(b.date + b.time),
    rated: (a, b) => (Number(b.driver?.rating_avg) || 0) - (Number(a.driver?.rating_avg) || 0),
    seats: (a, b) => b.seats_left - a.seats_left,
  };

  const shown = rides.filter((r) => {
    if (femaleFilter && !r.women_only) return false;
    if (filter.from && !r.from.toLowerCase().includes(q(filter.from))) return false;
    if (filter.to && !r.to.toLowerCase().includes(q(filter.to))) return false;
    if (filter.date && r.date !== filter.date) return false;
    if (filter.passengers && r.seats_left < filter.passengers) return false;
    return true;
  }).sort(SORTS[sort]);

  const shownReqs = requests.filter((r) => {
    if (filter.from && !r.from.toLowerCase().includes(q(filter.from))) return false;
    if (filter.to && !r.to.toLowerCase().includes(q(filter.to))) return false;
    if (filter.date && r.date !== filter.date) return false;
    return true;
  });

  const showingRides = view === "rides";
  const count = showingRides ? shown.length : shownReqs.length;
  const showResults = showingRides ? searched : true;
  const clearFilters = () => {
    setFilter({ from: "", to: "", date: "", passengers: 1 });
    setSearched(false);
  };

  return (
    <div className="cc-page">
      <style>{css}</style>
      <datalist id="rf-locs">
        {CAMPUS_LOCATIONS.map((l) => <option key={l} value={l} />)}
      </datalist>

      <header className="rf-head">
        <div>
          <h1 className="cc-h1">{showingRides ? "Find a ride" : "Riders looking"}</h1>
          <p className="cc-sub">
            {showingRides && !searched
              ? "Search a route to see who's driving."
              : loading && showingRides ? "Loading…"
              : `${count} ${showingRides ? "ride" : "request"}${count === 1 ? "" : "s"} ${showingRides ? "available" : "open"}`}
          </p>
        </div>
        <button className="rf-refresh" onClick={loadRides} aria-label="Refresh">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />
          </svg>
        </button>
      </header>

      {/* rides vs requests */}
      <div className="rf-seg" role="tablist">
        <button role="tab" aria-selected={showingRides}
          className={showingRides ? "on" : ""} onClick={() => setView("rides")}>
          Rides offered
        </button>
        <button role="tab" aria-selected={!showingRides}
          className={!showingRides ? "on" : ""} onClick={() => setView("requests")}>
          Ride requests
        </button>
      </div>

      {/* ---------- search ---------- */}
      <div className="rf-search">
        <div className="rf-field">
          <span className="rf-pin from" />
          <input list="rf-locs" placeholder="Leaving from" value={filter.from}
            onChange={(e) => setFilter({ ...filter, from: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && showingRides && setSearched(true)} />
        </div>
        <div className="rf-divider" />
        <div className="rf-field">
          <span className="rf-pin to" />
          <input list="rf-locs" placeholder="Going to" value={filter.to}
            onChange={(e) => setFilter({ ...filter, to: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && showingRides && setSearched(true)} />
        </div>
        <div className="rf-divider" />
        <div className="rf-field rf-field-sm">
          <select value={filter.passengers}
            onChange={(e) => setFilter({ ...filter, passengers: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} passenger{n > 1 ? "s" : ""}</option>
            ))}
          </select>
        </div>
        <div className="rf-divider" />
        <div className="rf-field rf-field-sm">
          <input type="date" min={new Date().toISOString().slice(0, 10)} value={filter.date}
            onChange={(e) => setFilter({ ...filter, date: e.target.value })} />
        </div>
      </div>

      {showingRides && (
        <button className="cc-btn cc-btn-block rf-search-btn" onClick={() => setSearched(true)}>
          Search rides
        </button>
      )}

      {showingRides && searched && (
        <div className="rf-recap">
          <span className="cc-dim cc-small">
            {filter.from || "Anywhere"} → {filter.to || "anywhere"}
            {filter.date ? ` · ${fmtDate(filter.date)}` : ""} · {filter.passengers} passenger{filter.passengers > 1 ? "s" : ""}
          </span>
          <button className="rf-clear" onClick={clearFilters}>Edit search</button>
        </div>
      )}

      {showingRides && searched && (
        <div className="rf-tools">
          {isFemale && (
            <button className={`rf-chip ${femaleFilter ? "on" : ""}`}
              onClick={() => setFemaleFilter((v) => !v)}>
              ♀ Women-only
            </button>
          )}
          <label className="rf-sort">
            <span className="cc-dim cc-small">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="soonest">Earliest departure</option>
              <option value="cheapest">Lowest price</option>
              <option value="rated">Best rated driver</option>
              <option value="seats">Most seats free</option>
            </select>
          </label>
        </div>
      )}

      {message && <p className="cc-msg" role="status">{message}</p>}

      {loading && showingRides && searched && (
        <div className="rf-list">
          {[0, 1, 2].map((i) => <div key={i} className="rf-skeleton" />)}
        </div>
      )}

      {!loading && showResults && count === 0 && (
        <div className="cc-empty">
          <p>
            {activeFilters ? `No ${showingRides ? "rides" : "requests"} match your search.`
              : showingRides ? "No rides posted yet." : "No one is looking for a ride."}
          </p>
          <p className="cc-dim cc-small">
            {activeFilters ? "Try widening the route or date."
              : showingRides ? "Be the first — post one and fill your empty seats."
                : "Post a request and let drivers come to you."}
          </p>
        </div>
      )}

      {/* ---------- ride requests ---------- */}
      {!showingRides && (
        <ul className="rf-list">
          {shownReqs.map((r) => {
            const rider = riders[r.rider_id];
            const mine = r.rider_id === userId;
            return (
              <li key={r.id} className="rf-card">
                <div className="rf-top">
                  <div className="rf-route">
                    <div className="rf-leg">
                      <div className="rf-time">{fmtDate(r.date)}</div>
                      <div className="rf-track"><span className="rf-dot" /><span className="rf-line" /></div>
                      <div className="rf-place">{r.from}</div>
                    </div>
                    <div className="rf-leg">
                      <div className="rf-time rf-dim-time">{r.time ? fmtTime(r.time) : "Flexible"}</div>
                      <div className="rf-track"><span className="rf-dot end" /></div>
                      <div className="rf-place">{r.to}</div>
                    </div>
                  </div>
                </div>

                <div className="rf-meta">
                  <span className="cc-badge cc-badge-grey">
                    {r.seats_needed} seat{r.seats_needed > 1 ? "s" : ""} needed
                  </span>
                  {!r.time && <span className="cc-badge cc-badge-grey">Time flexible</span>}
                </div>

                {r.note && <p className="rf-note">{r.note}</p>}

                <div className="rf-foot">
                  <button className="rf-driver" title="View profile"
                    onClick={() => setViewUser(r.rider_id)}>
                    <span className="cc-avatar rf-avatar">{rider?.name?.[0]?.toUpperCase() ?? "?"}</span>
                    <span className="rf-driver-txt">
                      <span className="rf-name">{rider?.name ?? "Student"}</span>
                      <span className="rf-driver-sub">
                        {rider?.rating_count > 0
                          ? <><span className="rf-star">★</span> {Number(rider.rating_avg).toFixed(1)} · {rider?.branch}</>
                          : <>New · {rider?.branch ?? "Chitkara"}</>}
                      </span>
                    </span>
                  </button>

                  {mine ? (
                    <button className="cc-btn cc-btn-ghost cc-btn-sm"
                      onClick={() => cancelRequest(r.id)}>Cancel</button>
                  ) : (
                    <button className="cc-btn cc-btn-sm"
                      onClick={() => onOffer?.({ from: r.from, to: r.to, date: r.date })}>
                      Offer a ride
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---------- rides ---------- */}
      <ul className="rf-list" hidden={!showingRides || !searched}>
        {shown.map((r) => {
          const mine = r.driver?.id === userId;
          const joined = joinedIds.has(r.id);
          const blocked = r.women_only && !isFemale;
          return (
            <li key={r.id} className="rf-card">
              {/* top: route timeline + price */}
              <div className="rf-top">
                <div className="rf-route">
                  <div className="rf-leg">
                    <div className="rf-time">{fmtTime(r.time)}</div>
                    <div className="rf-track"><span className="rf-dot" /><span className="rf-line" /></div>
                    <div className="rf-place">{r.from}</div>
                  </div>
                  <div className="rf-leg">
                    <div className="rf-time rf-dim-time">{fmtDate(r.date)}</div>
                    <div className="rf-track"><span className="rf-dot end" /></div>
                    <div className="rf-place">{r.to}</div>
                  </div>
                </div>
                <div className="rf-price">
                  <span className="rf-cur">₹</span>{Number(r.price).toFixed(0)}
                </div>
              </div>

              {/* meta badges */}
              <div className="rf-meta">
                <span className={`cc-badge ${r.seats_left <= 1 ? "cc-badge-amber" : "cc-badge-grey"}`}>
                  {r.seats_left} of {r.seats_total} left
                </span>
                {r.instant_book === false
                  ? <span className="cc-badge cc-badge-amber">Driver approves</span>
                  : <span className="cc-badge cc-badge-green">⚡ Instant</span>}
                {r.women_only && <span className="cc-badge cc-badge-pink">♀ Women only</span>}
                {(r.car_model || r.car_color) && (
                  <span className="cc-badge cc-badge-grey">
                    {[r.car_model, r.car_color].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>

              {r.note && <p className="rf-note">{r.note}</p>}

              {/* bottom: driver + action */}
              <div className="rf-foot">
                <button className="rf-driver" title="View profile"
                  onClick={() => r.driver?.id && setViewUser(r.driver.id)}>
                  <span className="cc-avatar rf-avatar">{r.driver?.name?.[0]?.toUpperCase() ?? "?"}</span>
                  <span className="rf-driver-txt">
                    <span className="rf-name">{r.driver?.name ?? "Student"}</span>
                    <span className="rf-driver-sub">
                      {r.driver?.rating_count > 0
                        ? <><span className="rf-star">★</span> {Number(r.driver.rating_avg).toFixed(1)} · {r.driver?.branch}</>
                        : <>New · {r.driver?.branch}</>}
                    </span>
                  </span>
                </button>

                {mine ? (
                  <span className="cc-badge cc-badge-blue">Your ride</span>
                ) : joined ? (
                  <button className="cc-btn cc-btn-ghost cc-btn-sm" disabled={joiningId === r.id}
                    onClick={() => leaveRide(r.id)}>
                    {joiningId === r.id ? "…" : "Leave"}
                  </button>
                ) : blocked ? (
                  <span className="cc-badge cc-badge-pink">Women only</span>
                ) : (
                  <button className="cc-btn cc-btn-sm" disabled={joiningId === r.id}
                    onClick={() => joinRide(r.id)}>
                    {joiningId === r.id ? "Sending…"
                      : r.instant_book === false ? "Request seat" : "Take a seat"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {viewUser && <UserProfile userId={viewUser} onClose={() => setViewUser(null)} />}
    </div>
  );
}

const css = `
.rf-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px}
.rf-refresh{background:var(--surface-2);border:1px solid var(--border);color:var(--text-2);
  border-radius:50%;width:40px;height:40px;display:grid;place-items:center;cursor:pointer;flex:none}
.rf-refresh:hover{color:var(--text);border-color:var(--border-strong)}
.rf-refresh:active{transform:rotate(90deg)}

/* search block */
.rf-search{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  overflow:hidden;margin-bottom:12px}
.rf-field{display:flex;align-items:center;gap:10px;padding:4px 14px}
.rf-field-sm{flex:0 0 auto}
.rf-field input,.rf-field select{background:none;border:0;padding:13px 0;font-size:15px;
  width:auto;color:var(--text);font-family:inherit;cursor:pointer}
.rf-field input{width:100%;cursor:text}
.rf-field input:focus,.rf-field select:focus{box-shadow:none}
.rf-divider{height:1px;background:var(--border);margin-left:38px}
.rf-field-sm + .rf-divider,.rf-field-sm ~ .rf-divider{margin-left:14px}
.rf-pin{width:9px;height:9px;border-radius:50%;flex:none;border:2px solid var(--text-3)}
.rf-pin.from{background:var(--text-3);border-color:var(--text-3)}
.rf-pin.to{border-color:var(--green);background:var(--green)}
.rf-search-btn{margin:12px 0 0}
.rf-recap{display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin:14px 0 4px;flex-wrap:wrap}
.rf-clear{background:none;border:0;color:var(--text-2);font-size:13px;font-family:inherit;
  cursor:pointer;padding:6px 2px;text-decoration:underline;text-underline-offset:3px;flex:none}
.rf-clear:hover{color:var(--text)}

.rf-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;
  flex-wrap:wrap;margin-bottom:18px}
.rf-sort{display:flex;align-items:center;gap:8px;margin-left:auto}
.rf-sort select{width:auto;padding:8px 11px;font-size:13px;font-weight:600;
  border-radius:var(--radius-pill);background:var(--surface-2)}
.rf-chip{background:none;border:1px solid var(--border-strong);color:var(--text-2);
  border-radius:var(--radius-pill);padding:8px 15px;font-size:13px;font-weight:600;
  font-family:inherit;cursor:pointer}
.rf-chip.on{background:var(--pink-dim);border-color:var(--pink);color:var(--pink)}

/* list + cards */
.rf-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px}
.rf-list[hidden]{display:none}
.rf-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--surface-2);
  border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px;margin-bottom:14px}
.rf-seg button{background:none;border:0;color:var(--text-2);font-family:inherit;
  font-size:13.5px;font-weight:650;padding:10px;border-radius:7px;cursor:pointer;
  transition:background .15s,color .15s}
.rf-seg button.on{background:var(--accent);color:var(--accent-fg)}
.rf-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:18px;transition:border-color .15s,transform .15s}
.rf-card:hover{border-color:var(--border-strong)}

.rf-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.rf-route{flex:1;min-width:0}
.rf-leg{display:grid;grid-template-columns:64px 16px 1fr;align-items:start;gap:10px}
.rf-time{font-size:14px;font-weight:700;padding-top:1px;white-space:nowrap}
.rf-dim-time{color:var(--text-3);font-weight:600;font-size:12.5px;padding-top:2px}
.rf-track{display:flex;flex-direction:column;align-items:center;height:100%;padding-top:5px}
.rf-dot{width:9px;height:9px;border-radius:50%;background:var(--text);flex:none}
.rf-dot.end{background:var(--green)}
.rf-line{flex:1;width:2px;min-height:26px;background:repeating-linear-gradient(
  to bottom,var(--border-strong) 0 4px,transparent 4px 8px);margin:3px 0}
.rf-place{font-size:15.5px;font-weight:600;padding-bottom:14px;line-height:1.25;
  overflow:hidden;text-overflow:ellipsis}
.rf-leg:last-child .rf-place{padding-bottom:0}
.rf-price{font-size:26px;font-weight:800;letter-spacing:-.04em;white-space:nowrap}
.rf-cur{font-size:17px;font-weight:700;margin-right:1px}

.rf-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}
.rf-note{font-size:13.5px;color:var(--text-2);margin:12px 0 0;line-height:1.5}

.rf-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;
  margin-top:16px;padding-top:15px;border-top:1px solid var(--border)}
.rf-driver{display:flex;align-items:center;gap:11px;min-width:0;background:none;border:0;
  padding:0;cursor:pointer;text-align:left;color:inherit;font:inherit}
.rf-avatar{width:38px;height:38px;font-size:15px}
.rf-driver-txt{display:flex;flex-direction:column;gap:2px;min-width:0}
.rf-name{font-size:14.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rf-driver:hover .rf-name{text-decoration:underline}
.rf-driver-sub{font-size:12.5px;color:var(--text-2)}
.rf-star{color:var(--amber)}

/* loading skeleton */
.rf-skeleton{height:170px;border-radius:var(--radius);background:var(--surface);
  border:1px solid var(--border);animation:rfPulse 1.4s ease-in-out infinite}
@keyframes rfPulse{0%,100%{opacity:.5}50%{opacity:.85}}

@media(max-width:420px){
  .rf-leg{grid-template-columns:56px 16px 1fr;gap:8px}
  .rf-price{font-size:23px}
  .rf-place{font-size:14.5px}
}
`;
