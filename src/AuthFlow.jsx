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
            <p className="cp-sub">We sent a login code to <strong>{email}</strong>.</p>
            <label className="cp-label" htmlFor="otp">Login code</label>
            <input
              id="otp" inputMode="numeric" autoComplete="one-time-code"
              maxLength={8} className="cp-otp" placeholder="••••••" autoFocus
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
  background:var(--bg);padding:24px}
.cp-card{width:100%;max-width:420px;background:var(--surface);border:1px solid var(--border);
  border-radius:20px;padding:32px 28px;box-shadow:var(--shadow);animation:cpIn .25s ease}
@keyframes cpIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

.cp-brand{display:flex;align-items:center;gap:11px;font-weight:700;font-size:16px;
  letter-spacing:-.02em;margin-bottom:28px}
.cp-logo{background:var(--text);color:var(--bg);border-radius:10px;width:32px;height:32px;
  display:grid;place-items:center;font-size:17px;font-weight:800}

/* step rail */
.cp-route{display:flex;align-items:center;margin-bottom:30px}
.cp-stop{display:flex;align-items:center;flex:1}
.cp-stop:last-child{flex:0}
.cp-dot{width:9px;height:9px;border-radius:50%;background:var(--surface-3);flex:none;
  transition:background .2s}
.cp-dot.on{background:var(--text)}
.cp-stop-label{font-size:11px;font-weight:600;color:var(--text-3);margin-left:7px}
.cp-stop-label.on{color:var(--text)}
.cp-dash{flex:1;height:2px;background:var(--surface-3);margin:0 10px;border-radius:2px}
.cp-dash.on{background:var(--text)}

.cp-card h1{font-size:23px;font-weight:700;margin:0 0 7px;letter-spacing:-.03em;line-height:1.2}
.cp-sub{color:var(--text-2);font-size:14px;margin:0 0 22px;line-height:1.5}
.cp-hint{color:var(--text-3);font-size:12px;margin:8px 0 0;line-height:1.45}
.cp-label{display:block;font-size:12px;font-weight:600;color:var(--text-2);margin:16px 0 7px}

.cp-otp{letter-spacing:.45em;text-align:center;font-size:24px;font-weight:700;padding:16px 15px}

.cp-btn{width:100%;margin-top:22px;background:var(--accent);color:var(--accent-fg);border:0;
  border-radius:var(--radius-sm);padding:15px;font-size:15px;font-weight:700;
  font-family:inherit;cursor:pointer;transition:transform .1s,opacity .15s}
.cp-btn:active:not(:disabled){transform:scale(.985)}
.cp-btn:disabled{opacity:.4;cursor:default}

.cp-error{color:var(--red);font-size:13px;margin:12px 0 0;line-height:1.45}
.cp-row{display:flex;justify-content:space-between;margin-top:18px}
.cp-link{background:none;border:0;color:var(--text-2);font-size:13px;font-family:inherit;
  cursor:pointer;padding:0;text-decoration:underline;text-underline-offset:3px}
.cp-link:hover:not(:disabled){color:var(--text)}
.cp-link:disabled{color:var(--text-3);cursor:default}
.cp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
`;
