import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { CAMPUS_LOCATIONS } from "./locations";

/*
  Post a ride. Client sends driver_id = self; seats_left auto-inits to
  seats_total and status defaults to 'open' via DB triggers (03_rides).
*/

const todayISO = () => new Date().toISOString().slice(0, 10);
const SEAT_OPTS = [1, 2, 3, 4, 5, 6];

export default function PostRide({ onPosted }) {
  const [form, setForm] = useState({
    from: "", to: "", date: todayISO(), time: "",
    seats: 3, price: "", note: "", women_only: false,
    car_model: "", car_color: "",
  });
  const [isFemale, setIsFemale] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // only women can offer a women-only ride, so only they see the toggle
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
    if (!time) return setError("Pick a departure time.");
    if (price !== "" && Number(price) < 0) return setError("Price can't be negative.");

    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("rides").insert({
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
    });
    setBusy(false);
    if (err) { setError(err.message); return; }

    setForm({
      from: "", to: "", date: todayISO(), time: "", seats: 3, price: "", note: "",
      women_only: false, car_model: form.car_model, car_color: form.car_color,
    });
    onPosted?.();
  }

  return (
    <div className="pr-wrap">
      <style>{css}</style>
      <datalist id="pr-locs">
        {CAMPUS_LOCATIONS.map((l) => <option key={l} value={l} />)}
      </datalist>
      <h1>Post a ride</h1>
      <p className="pr-sub">Fill your empty seats and split the fare.</p>

      <form onSubmit={submit}>
        <div className="pr-grid">
          <div>
            <label className="pr-label" htmlFor="from">From</label>
            <input id="from" list="pr-locs" autoFocus placeholder="Main Gate" value={form.from} onChange={set("from")} />
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
            <label className="pr-label" htmlFor="time">Departs</label>
            <input id="time" type="time" value={form.time} onChange={set("time")} />
          </div>
        </div>

        <div className="pr-grid">
          <div>
            <label className="pr-label" htmlFor="seats">Seats</label>
            <select id="seats" value={form.seats} onChange={set("seats")}>
              {SEAT_OPTS.map((n) => <option key={n} value={n}>{n} seat{n > 1 ? "s" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="pr-label" htmlFor="price">Price / seat (₹)</label>
            <input id="price" inputMode="numeric" placeholder="0" value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d]/g, "") })} />
          </div>
        </div>

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

        <label className="pr-label" htmlFor="note">Note <span className="pr-opt">(optional)</span></label>
        <textarea id="note" rows={3} placeholder="AC car, leaving sharp, drop near ISBT…"
          value={form.note} onChange={set("note")} />

        {isFemale && (
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
          {busy ? "Posting…" : "Post ride"}
        </button>
      </form>
    </div>
  );
}

const css = `
.pr-wrap{max-width:640px;margin:0 auto;padding:28px 20px 40px;
  font-family:'Inter',system-ui,sans-serif;color:#e8efe9}
.pr-wrap h1{font-size:22px;font-weight:650;margin:0 0 4px;letter-spacing:-.01em}
.pr-sub{color:#93a69a;font-size:13.5px;margin:0 0 22px}
.pr-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pr-label{display:block;font-size:12px;color:#93a69a;margin:14px 0 6px;
  text-transform:uppercase;letter-spacing:.06em}
.pr-opt{text-transform:none;letter-spacing:0;color:#6d7f74}
input,select,textarea{width:100%;box-sizing:border-box;background:#0e1512;color:#e8efe9;
  border:1px solid #2b3d33;border-radius:10px;padding:12px 14px;font-size:15px;outline:none;
  font-family:inherit}
textarea{resize:vertical}
input:focus,select:focus,textarea:focus{border-color:#5fd08a;box-shadow:0 0 0 3px rgba(95,208,138,.15)}
.pr-hint{color:#6d7f74;font-size:12px;margin:8px 0 0;line-height:1.4}
.pr-toggle{display:flex;gap:11px;align-items:flex-start;margin-top:18px;padding:14px;
  background:#16201b;border:1px solid #24332b;border-radius:12px;cursor:pointer}
.pr-toggle input{width:18px;height:18px;flex:none;margin-top:2px;accent-color:#c48fd0}
.pr-toggle span{display:flex;flex-direction:column;gap:2px}
.pr-toggle-title{font-size:14px;font-weight:600;color:#e8dcef}
.pr-toggle-sub{font-size:12.5px;color:#93a69a;line-height:1.4}
.pr-error{color:#ff9d8f;font-size:13px;margin:12px 0 0;line-height:1.4}
.pr-btn{width:100%;margin-top:20px;background:#5fd08a;color:#0b120e;border:0;
  border-radius:10px;padding:13px;font-size:15px;font-weight:650;cursor:pointer}
.pr-btn:disabled{opacity:.55;cursor:default}
.pr-btn:not(:disabled):hover{background:#74dc9c}
`;
