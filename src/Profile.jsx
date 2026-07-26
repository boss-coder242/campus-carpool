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
.pf-wrap{max-width:620px;margin:0 auto;padding:28px 18px 40px}
.pf-head{display:flex;gap:16px;align-items:center;margin-bottom:22px;padding-bottom:22px;
  border-bottom:1px solid var(--border)}
.pf-avatar{width:64px;height:64px;border-radius:50%;background:var(--surface-3);
  color:var(--text);display:grid;place-items:center;font-weight:700;font-size:26px;flex:none}
.pf-hname{font-size:22px;font-weight:700;letter-spacing:-.03em}
.pf-rating{font-size:13.5px;color:var(--amber);margin-top:5px;font-weight:600}
.pf-dim{color:var(--text-2)}
.pf-small{font-size:12.5px}
.pf-label{display:block;font-size:12px;font-weight:600;color:var(--text-2);margin:18px 0 7px}
.pf-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pf-error{color:var(--red);font-size:13px;margin:14px 0 0}
.pf-ok{color:var(--green);font-size:13px;margin:14px 0 0}
.pf-btn{width:100%;margin-top:24px;background:var(--accent);color:var(--accent-fg);border:0;
  border-radius:var(--radius-sm);padding:16px;font-size:15px;font-weight:700;
  font-family:inherit;cursor:pointer;transition:transform .1s,opacity .15s}
.pf-btn:active:not(:disabled){transform:scale(.985)}
.pf-btn:disabled{opacity:.4;cursor:default}
.pf-signout{width:100%;margin-top:12px;background:transparent;border:1px solid var(--border-strong);
  color:var(--red);border-radius:var(--radius-sm);padding:15px;font-size:14.5px;
  font-weight:650;font-family:inherit;cursor:pointer;transition:background .15s}
.pf-signout:hover{background:var(--red-dim);border-color:var(--red)}
@media(max-width:420px){.pf-wrap{padding:22px 14px 34px}}
`;
