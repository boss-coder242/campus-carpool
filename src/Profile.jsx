import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/*
  Profile — read your own row (users RLS allows only self), edit the
  safe columns, sign out. email / rating_* are DB-frozen and shown read-only.
*/

const BRANCHES = ["CSE", "AI/ML", "ECE", "ME", "CE", "BBA", "MBA", "Pharmacy", "Other"];
const YEARS = [1, 2, 3, 4, 5];
const GENDERS = [
  { v: "female", l: "Woman" },
  { v: "male", l: "Man" },
  { v: "na", l: "Prefer not to say" },
];

export default function Profile() {
  const [row, setRow] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", branch: "", year: "", gender: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("users")
      .select("email, name, phone, branch, year, gender, rating_avg, rating_count")
      .eq("id", user.id).single();
    if (data) {
      setRow(data);
      setForm({
        name: data.name ?? "", phone: data.phone ?? "",
        branch: data.branch ?? "", year: data.year ?? "",
        gender: data.gender ?? "",
      });
    }
  }

  async function save(e) {
    e.preventDefault();
    setError(""); setMsg("");
    if (!form.name.trim()) return setError("Enter your name.");
    if (!/^[6-9]\d{9}$/.test(form.phone.trim()))
      return setError("Enter a valid 10-digit Indian mobile number.");
    if (!form.branch) return setError("Select your branch.");
    if (!form.year) return setError("Select your year.");
    if (!form.gender) return setError("Select your gender.");

    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("users").update({
      name: form.name.trim(), phone: form.phone.trim(),
      branch: form.branch, year: Number(form.year), gender: form.gender,
    }).eq("id", user.id);
    setBusy(false);
    if (err) return setError(err.message);
    setMsg("Profile saved.");
    load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (!row) return <div className="pf-wrap"><style>{css}</style><p className="pf-dim">Loading…</p></div>;

  return (
    <div className="pf-wrap">
      <style>{css}</style>

      <div className="pf-head">
        <div className="pf-avatar">{(form.name || row.email)[0]?.toUpperCase()}</div>
        <div>
          <div className="pf-hname">{form.name || "Your profile"}</div>
          <div className="pf-dim pf-small">{row.email}</div>
          <div className="pf-rating">
            {row.rating_count > 0
              ? <>★ {Number(row.rating_avg).toFixed(1)} <span className="pf-dim">· {row.rating_count} rating{row.rating_count > 1 ? "s" : ""}</span></>
              : <span className="pf-dim">No ratings yet</span>}
          </div>
        </div>
      </div>

      <form onSubmit={save}>
        <label className="pf-label" htmlFor="name">Full name</label>
        <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <label className="pf-label" htmlFor="phone">Phone</label>
        <input id="phone" inputMode="numeric" maxLength={10} value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />

        <div className="pf-grid">
          <div>
            <label className="pf-label" htmlFor="branch">Branch</label>
            <select id="branch" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              <option value="">Select</option>
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="pf-label" htmlFor="year">Year</label>
            <select id="year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
              <option value="">Select</option>
              {YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
        </div>

        <label className="pf-label" htmlFor="gender">Gender</label>
        <select id="gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option value="">Select</option>
          {GENDERS.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}
        </select>
        <p className="pf-dim pf-small" style={{ marginTop: 6 }}>
          Private — powers opt-in women-only rides, never shown publicly.
        </p>

        {error && <p className="pf-error" role="alert">{error}</p>}
        {msg && <p className="pf-ok" role="status">{msg}</p>}
        <button type="submit" className="pf-btn" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </form>

      <button className="pf-signout" onClick={signOut}>Sign out</button>
    </div>
  );
}

const css = `
.pf-wrap{max-width:640px;margin:0 auto;padding:28px 20px 40px;
  font-family:'Inter',system-ui,sans-serif;color:#e8efe9}
.pf-head{display:flex;gap:14px;align-items:center;margin-bottom:8px}
.pf-avatar{width:52px;height:52px;border-radius:50%;background:#24382c;color:#9fd8b4;
  display:grid;place-items:center;font-weight:650;font-size:22px;flex:none}
.pf-hname{font-size:19px;font-weight:650;letter-spacing:-.01em}
.pf-rating{font-size:13.5px;color:#f2c14e;margin-top:3px}
.pf-dim{color:#93a69a}
.pf-small{font-size:12.5px}
.pf-label{display:block;font-size:12px;color:#93a69a;margin:16px 0 6px;
  text-transform:uppercase;letter-spacing:.06em}
.pf-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
input,select{width:100%;box-sizing:border-box;background:#0e1512;color:#e8efe9;
  border:1px solid #2b3d33;border-radius:10px;padding:12px 14px;font-size:15px;outline:none}
input:focus,select:focus{border-color:#5fd08a;box-shadow:0 0 0 3px rgba(95,208,138,.15)}
.pf-error{color:#ff9d8f;font-size:13px;margin:12px 0 0}
.pf-ok{color:#5fd08a;font-size:13px;margin:12px 0 0}
.pf-btn{width:100%;margin-top:20px;background:#5fd08a;color:#0b120e;border:0;
  border-radius:10px;padding:13px;font-size:15px;font-weight:650;cursor:pointer}
.pf-btn:disabled{opacity:.55;cursor:default}
.pf-signout{width:100%;margin-top:12px;background:none;border:1px solid #4a2e2e;
  color:#e08a8a;border-radius:10px;padding:12px;font-size:14px;font-weight:600;cursor:pointer}
.pf-signout:hover{background:#211414}
`;
