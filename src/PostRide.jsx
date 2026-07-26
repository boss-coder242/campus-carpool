import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { CAMPUS_LOCATIONS } from "./locations";

/*
  Two modes on one form:
    offer   -> inserts into rides         (driver_id = self; seats_left and
                                           status set by triggers, 03_rides)
    request -> inserts into ride_requests (rider_id = self; 09_ride_requests)
  `prefill` lets the feed hand over a route ("offer a ride for this request").
*/

const todayISO = () => new Date().toISOString().slice(0, 10);
const SEAT_OPTS = [1, 2, 3, 4, 5, 6];

const EMPTY = {
  from: "", to: "", date: todayISO(), time: "",
  seats: 3, price: "", note: "", women_only: false,
  car_model: "", car_color: "", instant_book: true,
};

export default function PostRide({ onPosted, prefill, onPrefillUsed }) {
  const [mode, setMode] = useState("offer"); // offer | request
  const [form, setForm] = useState(EMPTY);
  const [isFemale, setIsFemale] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const offering = mode === "offer";

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("gender").eq("id", user.id).single();
      setIsFemale(data?.gender === "female");

      // prefill the car from the last ride this student posted
      const { data: last } = await supabase
        .from("rides").select("car_model, car_color")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last?.car_model || last?.car_color) {
        setForm((f) => ({
          ...f,
          car_model: f.car_model || last.car_model || "",
          car_color: f.car_color || last.car_color || "",
        }));
      }
    })();
  }, []);

  // someone tapped "Offer a ride" on a request in the feed
  useEffect(() => {
    if (!prefill) return;
    setMode("offer");
    setForm((f) => ({
      ...f,
      from: prefill.from ?? f.from,
      to: prefill.to ?? f.to,
      date: prefill.date ?? f.date,
    }));
    setError("");
    onPrefillUsed?.();
  }, [prefill]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    const { from, to, date, time, seats, price, note } = form;
    if (!from.trim()) return setError("Where are you leaving from?");
    if (!to.trim()) return setError("Where are you headed?");
    if (from.trim().toLowerCase() === to.trim().toLowerCase())
      return setError("Pick-up and drop-off can't be the same place.");
    if (!date) return setError("Pick a date.");
    if (date < todayISO()) return setError("That date is in the past.");
    if (offering && !time) return setError("Pick a departure time.");
    if (offering && price !== "" && Number(price) < 0)
      return setError("Price can't be negative.");

    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error: err } = offering
      ? await supabase.from("rides").insert({
          driver_id: user.id,
          from: from.trim(),
          to: to.trim(),
          date,
          time,
          seats_total: Number(seats),
          price: price === "" ? 0 : Number(price),
          note: note.trim() || null,
          women_only: isFemale ? form.women_only : false,
          car_model: form.car_model.trim() || null,
          car_color: form.car_color.trim() || null,
          instant_book: form.instant_book,
        })
      : await supabase.from("ride_requests").insert({
          rider_id: user.id,
          from: from.trim(),
          to: to.trim(),
          date,
          time: time || null,          // null = flexible
          seats_needed: Number(seats),
          note: note.trim() || null,
        });

    setBusy(false);
    if (err) { setError(err.message); return; }

    setForm({ ...EMPTY, car_model: form.car_model, car_color: form.car_color });
    onPosted?.();
  }

  return (
    <div className="pr-wrap">
      <style>{css}</style>
      <datalist id="pr-locs">
        {CAMPUS_LOCATIONS.map((l) => <option key={l} value={l} />)}
      </datalist>

      <h1>{offering ? "Offer a ride" : "Ask for a ride"}</h1>
      <p className="pr-sub">
        {offering
          ? "Fill your empty seats and split the fare."
          : "No ride yet? Post where you're going and let drivers find you."}
      </p>

      {/* mode switch */}
      <div className="pr-seg" role="tablist">
        <button type="button" role="tab" aria-selected={offering}
          className={offering ? "on" : ""} onClick={() => { setMode("offer"); setError(""); }}>
          I'm driving
        </button>
        <button type="button" role="tab" aria-selected={!offering}
          className={!offering ? "on" : ""} onClick={() => { setMode("request"); setError(""); }}>
          I need a ride
        </button>
      </div>

      <form onSubmit={submit}>
        <div className="pr-grid">
          <div>
            <label className="pr-label" htmlFor="from">From</label>
            <input id="from" list="pr-locs" placeholder="Main Gate" value={form.from} onChange={set("from")} />
          </div>
          <div>
            <label className="pr-label" htmlFor="to">To</label>
            <input id="to" list="pr-locs" placeholder="Panchkula" value={form.to} onChange={set("to")} />
          </div>
        </div>

        <div className="pr-grid">
          <div>
            <label className="pr-label" htmlFor="date">Date</label>
            <input id="date" type="date" min={todayISO()} value={form.date} onChange={set("date")} />
          </div>
          <div>
            <label className="pr-label" htmlFor="time">
              {offering ? "Departs" : <>Preferred time <span className="pr-opt">(optional)</span></>}
            </label>
            <input id="time" type="time" value={form.time} onChange={set("time")} />
          </div>
        </div>

        <div className="pr-grid">
          <div>
            <label className="pr-label" htmlFor="seats">{offering ? "Seats" : "Seats needed"}</label>
            <select id="seats" value={form.seats} onChange={set("seats")}>
              {SEAT_OPTS.map((n) => <option key={n} value={n}>{n} seat{n > 1 ? "s" : ""}</option>)}
            </select>
          </div>
          {offering && (
            <div>
              <label className="pr-label" htmlFor="price">Price / seat (₹)</label>
              <input id="price" inputMode="numeric" placeholder="0" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d]/g, "") })} />
            </div>
          )}
        </div>

        {offering && (
          <>
            <div className="pr-grid">
              <div>
                <label className="pr-label" htmlFor="car">Car <span className="pr-opt">(optional)</span></label>
                <input id="car" placeholder="Maruti Swift" value={form.car_model}
                  onChange={set("car_model")} />
              </div>
              <div>
                <label className="pr-label" htmlFor="carcol">Colour <span className="pr-opt">(optional)</span></label>
                <input id="carcol" placeholder="White" value={form.car_color}
                  onChange={set("car_color")} />
              </div>
            </div>
            <p className="pr-hint">Helps riders spot you at a busy gate.</p>
          </>
        )}

        <label className="pr-label" htmlFor="note">Note <span className="pr-opt">(optional)</span></label>
        <textarea id="note" rows={3}
          placeholder={offering ? "AC car, leaving sharp, drop near ISBT…" : "Flexible by 30 min, small bag…"}
          value={form.note} onChange={set("note")} />

        {offering && (
          <>
            <label className="pr-label">Who can book</label>
            <div className="pr-book">
              {[
                { v: true, t: "Instant booking", s: "Anyone with a college email takes a seat right away." },
                { v: false, t: "Approve each request", s: "You see who's asking and accept or decline." },
              ].map((o) => (
                <button type="button" key={String(o.v)}
                  className={`pr-book-opt ${form.instant_book === o.v ? "on" : ""}`}
                  onClick={() => setForm({ ...form, instant_book: o.v })}>
                  <span className="pr-radio" />
                  <span>
                    <span className="pr-book-t">{o.t}</span>
                    <span className="pr-book-s">{o.s}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {offering && isFemale && (
          <label className="pr-toggle">
            <input type="checkbox" checked={form.women_only}
              onChange={(e) => setForm({ ...form, women_only: e.target.checked })} />
            <span>
              <span className="pr-toggle-title">Women-only ride</span>
              <span className="pr-toggle-sub">Only women can see this ride as bookable and join it.</span>
            </span>
          </label>
        )}

        {error && <p className="pr-error" role="alert">{error}</p>}
        <button type="submit" className="pr-btn" disabled={busy}>
          {busy ? "Posting…" : offering ? "Post ride" : "Post request"}
        </button>
      </form>
    </div>
  );
}

const css = `
.pr-wrap{max-width:620px;margin:0 auto;padding:28px 18px 40px}
.pr-wrap h1{font-size:28px;font-weight:700;margin:0 0 6px;letter-spacing:-.03em}
.pr-sub{color:var(--text-2);font-size:14px;margin:0 0 18px;line-height:1.5}
.pr-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--surface-2);
  border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px;margin-bottom:6px}
.pr-seg button{background:none;border:0;color:var(--text-2);font-family:inherit;
  font-size:13.5px;font-weight:650;padding:10px;border-radius:7px;cursor:pointer;
  transition:background .15s,color .15s}
.pr-seg button.on{background:var(--accent);color:var(--accent-fg)}
.pr-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pr-label{display:block;font-size:12px;font-weight:600;color:var(--text-2);margin:18px 0 7px}
.pr-opt{color:var(--text-3);font-weight:500}
.pr-hint{color:var(--text-3);font-size:12px;margin:8px 0 0;line-height:1.45}

.pr-toggle{display:flex;gap:12px;align-items:flex-start;margin-top:22px;padding:16px;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  cursor:pointer;transition:border-color .15s}
.pr-toggle:hover{border-color:var(--border-strong)}
.pr-toggle input{width:19px;height:19px;flex:none;margin:1px 0 0;accent-color:var(--pink)}
.pr-toggle span{display:flex;flex-direction:column;gap:3px}
.pr-toggle-title{font-size:14.5px;font-weight:650}
.pr-toggle-sub{font-size:12.5px;color:var(--text-2);line-height:1.45}

.pr-book{display:flex;flex-direction:column;gap:8px}
.pr-book-opt{display:flex;gap:12px;align-items:flex-start;text-align:left;padding:14px;
  background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  cursor:pointer;font-family:inherit;color:inherit;transition:border-color .15s}
.pr-book-opt.on{border-color:var(--text)}
.pr-book-opt span{display:flex;flex-direction:column;gap:3px}
.pr-radio{width:18px;height:18px;border-radius:50%;border:2px solid var(--border-strong);
  flex:none;margin-top:1px;display:block;transition:border-color .15s}
.pr-book-opt.on .pr-radio{border-color:var(--text);border-width:5px}
.pr-book-t{font-size:14.5px;font-weight:650}
.pr-book-s{font-size:12.5px;color:var(--text-2);line-height:1.45}
.pr-error{color:var(--red);font-size:13px;margin:14px 0 0;line-height:1.45}
.pr-btn{width:100%;margin-top:24px;background:var(--accent);color:var(--accent-fg);border:0;
  border-radius:var(--radius-sm);padding:16px;font-size:15px;font-weight:700;
  font-family:inherit;cursor:pointer;transition:transform .1s,opacity .15s}
.pr-btn:active:not(:disabled){transform:scale(.985)}
.pr-btn:disabled{opacity:.4;cursor:default}
@media(max-width:420px){.pr-wrap{padding:22px 14px 34px}.pr-wrap h1{font-size:24px}}
`;
