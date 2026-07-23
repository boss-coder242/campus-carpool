import { useEffect, useRef, useState } from "react";
import { supabase, isAllowedEmail, ALLOWED_DOMAIN } from "./supabaseClient";

/*
  Carpool auth flow — 3 waypoints:
  email → verify OTP → profile setup
  Renders children (the app) once the profile is complete.
*/

const BRANCHES = ["CSE", "AI/ML", "ECE", "ME", "CE", "BBA", "MBA", "Pharmacy", "Other"];
const YEARS = [1, 2, 3, 4, 5];
// gender is private (own-row only) and powers opt-in women-only rides
const GENDERS = [
  { v: "female", l: "Woman" },
  { v: "male", l: "Man" },
  { v: "na", l: "Prefer not to say" },
];

export default function AuthFlow({ children }) {
  const [step, setStep] = useState("loading"); // loading | email | otp | profile | done
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [profile, setProfile] = useState({ name: "", phone: "", branch: "", year: "", gender: "" });
  const timerRef = useRef(null);

  // ---- session bootstrap ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      data.session ? checkProfile(data.session.user.id) : setStep("email");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function checkProfile(userId) {
    const { data } = await supabase
      .from("users")
      .select("name, phone, branch, year, gender")
      .eq("id", userId)
      .single();
    if (data?.name && data?.phone && data?.branch && data?.year && data?.gender) {
      setStep("done");
    } else {
      if (data) setProfile({
        name: data.name ?? "", phone: data.phone ?? "",
        branch: data.branch ?? "", year: data.year ?? "",
        gender: data.gender ?? "",
      });
      setStep("profile");
    }
  }

  function startCooldown(s = 45) {
    setCooldown(s);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  // ---- step 1: send OTP ----
  async function sendOtp(resend = false) {
    setError("");
    const addr = email.trim().toLowerCase();
    if (!isAllowedEmail(addr)) {
      setError(`Use your @${ALLOWED_DOMAIN} college email to sign up.`);
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) {
      // Server-side trigger rejection surfaces here too
      setError(
        /chitkara|database error/i.test(err.message)
          ? `Signups are restricted to @${ALLOWED_DOMAIN} addresses.`
          : err.message
      );
      return;
    }
    startCooldown();
    if (!resend) { setOtp(""); setStep("otp"); }
  }

  // ---- step 2: verify OTP ----
  async function verifyOtp() {
    setError("");
    if (otp.trim().length < 6) { setError("Enter the 6-digit code from your email."); return; }
    setBusy(true);
    const { data, error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: "email",
    });
    setBusy(false);
    if (err) { setError("That code didn't match or has expired. Try again or resend."); return; }
    checkProfile(data.session.user.id);
  }

  // ---- step 3: save profile ----
  async function saveProfile(e) {
    e?.preventDefault?.();
    setError("");
    const { name, phone, branch, year, gender } = profile;
    if (!name.trim()) return setError("Enter your full name.");
    if (!/^[6-9]\d{9}$/.test(phone.trim()))
      return setError("Enter a valid 10-digit Indian mobile number.");
    if (!branch) return setError("Select your branch.");
    if (!year) return setError("Select your year.");
    if (!gender) return setError("Select your gender.");

    setBusy(true);
    const { error: err } = await supabase
      .from("users")
      .update({
        name: name.trim(),
        phone: phone.trim(),
        branch,
        year: Number(year),
        gender,
      })
      .eq("id", session.user.id);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setStep("done");
  }

  if (step === "done") return children ?? <div className="cp-shell"><p>You're in. 🚗</p></div>;
  if (step === "loading") return <div className="cp-shell" />;

  const waypoint = step === "email" ? 0 : step === "otp" ? 1 : 2;

  return (
    <div className="cp-shell">
      <style>{css}</style>
      <div className="cp-card">
        <div className="cp-brand">
          <span className="cp-logo">⇄</span>
          <span>Campus Carpool</span>
        </div>

        {/* route-line progress */}
        <div className="cp-route" aria-hidden="true">
          {["Email", "Verify", "Profile"].map((label, i) => (
            <div key={label} className="cp-stop">
              <span className={`cp-dot ${i <= waypoint ? "on" : ""}`} />
              <span className={`cp-stop-label ${i === waypoint ? "on" : ""}`}>{label}</span>
              {i < 2 && <span className={`cp-dash ${i < waypoint ? "on" : ""}`} />}
            </div>
          ))}
        </div>

        {step === "email" && (
          <>
            <h1>Sign in with your college email</h1>
            <p className="cp-sub">Only @{ALLOWED_DOMAIN} addresses can ride.</p>
            <label className="cp-label" htmlFor="email">College email</label>
            <input
              id="email" type="email" inputMode="email" autoFocus
              placeholder={`you@${ALLOWED_DOMAIN}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendOtp()}
            />
            {error && <p className="cp-error" role="alert">{error}</p>}
            <button className="cp-btn" disabled={busy} onClick={() => sendOtp()}>
              {busy ? "Sending code…" : "Send login code"}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <h1>Check your inbox</h1>
            <p className="cp-sub">We sent a 6-digit code to <strong>{email}</strong>.</p>
            <label className="cp-label" htmlFor="otp">Login code</label>
            <input
              id="otp" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} className="cp-otp" placeholder="••••••" autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
            />
            {error && <p className="cp-error" role="alert">{error}</p>}
            <button className="cp-btn" disabled={busy} onClick={verifyOtp}>
              {busy ? "Verifying…" : "Verify code"}
            </button>
            <div className="cp-row">
              <button className="cp-link" disabled={cooldown > 0 || busy} onClick={() => sendOtp(true)}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
              <button className="cp-link" onClick={() => { setStep("email"); setError(""); }}>
                Change email
              </button>
            </div>
          </>
        )}

        {step === "profile" && (
          <form onSubmit={saveProfile}>
            <h1>Set up your profile</h1>
            <p className="cp-sub">Riders and drivers see this before sharing a seat.</p>

            <label className="cp-label" htmlFor="name">Full name</label>
            <input id="name" autoFocus value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })} />

            <label className="cp-label" htmlFor="phone">Phone number</label>
            <input id="phone" inputMode="numeric" maxLength={10} placeholder="98XXXXXXXX"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value.replace(/\D/g, "") })} />

            <div className="cp-grid">
              <div>
                <label className="cp-label" htmlFor="branch">Branch</label>
                <select id="branch" value={profile.branch}
                  onChange={(e) => setProfile({ ...profile, branch: e.target.value })}>
                  <option value="">Select</option>
                  {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="cp-label" htmlFor="year">Year</label>
                <select id="year" value={profile.year}
                  onChange={(e) => setProfile({ ...profile, year: e.target.value })}>
                  <option value="">Select</option>
                  {YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
            </div>

            <label className="cp-label" htmlFor="gender">Gender</label>
            <select id="gender" value={profile.gender}
              onChange={(e) => setProfile({ ...profile, gender: e.target.value })}>
              <option value="">Select</option>
              {GENDERS.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}
            </select>
            <p className="cp-hint">Used only to power opt-in women-only rides. Never shown on your public profile.</p>

            {error && <p className="cp-error" role="alert">{error}</p>}
            <button type="submit" className="cp-btn" disabled={busy}>
              {busy ? "Saving…" : "Start carpooling"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const css = `
.cp-shell{min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#0e1512;padding:24px;font-family:'Inter',system-ui,sans-serif;color:#e8efe9}
.cp-card{width:100%;max-width:400px;background:#16201b;border:1px solid #24332b;
  border-radius:18px;padding:32px 28px}
.cp-brand{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:.02em;
  color:#9fd8b4;margin-bottom:22px;font-size:15px}
.cp-logo{background:#1f3328;border:1px solid #2e4a38;border-radius:8px;
  width:28px;height:28px;display:grid;place-items:center;font-size:16px}
.cp-route{display:flex;align-items:flex-start;margin-bottom:26px}
.cp-stop{display:flex;align-items:center;flex:1}
.cp-stop:last-child{flex:0}
.cp-dot{width:10px;height:10px;border-radius:50%;border:2px solid #3a5244;flex:none}
.cp-dot.on{background:#5fd08a;border-color:#5fd08a}
.cp-stop-label{font-size:11px;color:#6d7f74;margin-left:6px}
.cp-stop-label.on{color:#e8efe9}
.cp-dash{flex:1;border-top:2px dashed #3a5244;margin:0 8px}
.cp-dash.on{border-color:#5fd08a}
h1{font-size:20px;font-weight:650;margin:0 0 6px;letter-spacing:-.01em}
.cp-sub{color:#93a69a;font-size:13.5px;margin:0 0 20px;line-height:1.5}
.cp-hint{color:#6d7f74;font-size:12px;margin:8px 0 0;line-height:1.4}
.cp-label{display:block;font-size:12px;color:#93a69a;margin:14px 0 6px;
  text-transform:uppercase;letter-spacing:.06em}
input,select{width:100%;box-sizing:border-box;background:#0e1512;color:#e8efe9;
  border:1px solid #2b3d33;border-radius:10px;padding:12px 14px;font-size:15px;outline:none}
input:focus,select:focus{border-color:#5fd08a;box-shadow:0 0 0 3px rgba(95,208,138,.15)}
.cp-otp{letter-spacing:.5em;text-align:center;font-size:22px;font-weight:600}
.cp-btn{width:100%;margin-top:18px;background:#5fd08a;color:#0b120e;border:0;
  border-radius:10px;padding:13px;font-size:15px;font-weight:650;cursor:pointer}
.cp-btn:disabled{opacity:.55;cursor:default}
.cp-btn:not(:disabled):hover{background:#74dc9c}
.cp-error{color:#ff9d8f;font-size:13px;margin:10px 0 0;line-height:1.4}
.cp-row{display:flex;justify-content:space-between;margin-top:14px}
.cp-link{background:none;border:0;color:#9fd8b4;font-size:13px;cursor:pointer;padding:0}
.cp-link:disabled{color:#546257;cursor:default}
.cp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (prefers-reduced-motion:no-preference){.cp-card{animation:cpIn .25s ease}
@keyframes cpIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}
`;
