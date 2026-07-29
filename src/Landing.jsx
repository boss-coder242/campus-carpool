import heroPhoto from "./assets/hero-friends.png";

/*
  Pre-login marketing splash — shown to signed-out visitors before the
  email step. Laid out like blablacar.in: a full-width hero band (nav +
  headline/photo split + search bar) sitting on --surface, then a plain
  feature row below. Everything here is decorative: there is no data to
  search without an account (RLS requires `authenticated`), so every
  control just leads into the sign-in flow via onStart().
*/

const FEATURES = [
  {
    icon: <><circle cx="12" cy="10" r="3" /><path d="M12 21s7-6.5 7-11a7 7 0 0 0-14 0c0 4.5 7 11 7 11Z" /></>,
    title: "Every route on campus",
    text: "Main Gate, hostels, ISBT, Panchkula, Zirakpur — post or find a ride in seconds.",
  },
  {
    icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5-1.3 2-3 2.5-3 1.1-3 2.5 1.3 2.5 3 2.5 3-1.1 3-2.5" /></>,
    title: "Split fares, save money",
    text: "Drivers cover fuel, riders skip the cab fare. Everyone pays less.",
  },
  {
    icon: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    title: "Ride with confidence",
    text: "Every rider signs in with a @chitkara.edu.in email, then rates and reviews after each ride.",
  },
];

const Icon = ({ d, size = 22, sw = 1.9 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const SEARCH_ICON = <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>;

export default function Landing({ onStart }) {
  return (
    <div className="ld-page">
      <style>{css}</style>

      {/* full-width band, like BlaBlaCar's hero section */}
      <div className="ld-band">
        <header className="ld-nav">
          <div className="ld-brand">
            <span className="ld-logo">⇄</span>
            <span>Campus Carpool</span>
          </div>
          <div className="ld-nav-actions">
            <button className="ld-icon-btn" onClick={onStart} aria-label="Search">
              <Icon d={SEARCH_ICON} size={18} />
            </button>
            <button className="cc-btn cc-btn-ghost cc-btn-sm ld-nav-cta" onClick={onStart}>
              Offer a ride
            </button>
            <button className="ld-avatar" onClick={onStart} aria-label="Sign in">
              <Icon d={<><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>} size={17} sw={2.1} />
            </button>
          </div>
        </header>

        <section className="ld-hero">
          <div className="ld-hero-txt">
            <h1 className="ld-h1">Travel together.<br />Spend smarter.</h1>
            <p className="ld-sub">
              The carpool board built for Chitkara students — post an empty
              seat or find one, anywhere between campus and home.
            </p>
          </div>

          <div className="ld-art">
            <img className="ld-photo" src={heroPhoto} alt="Students sharing a ride together, laughing in the car" />
          </div>
        </section>

        {/* decorative search — routes into sign-in, nothing to browse pre-login */}
        <button className="ld-search" onClick={onStart}>
          <div className="ld-search-field">
            <div className="ld-search-label">From</div>
            <div className="ld-search-val">Main Gate, Chitkara</div>
          </div>
          <div className="ld-search-div" />
          <div className="ld-search-field">
            <div className="ld-search-label">To</div>
            <div className="ld-search-val">Panchkula</div>
          </div>
          <div className="ld-search-div" />
          <div className="ld-search-field ld-search-field-sm">
            <div className="ld-search-label">Date</div>
            <div className="ld-search-val">Today</div>
          </div>
          <span className="cc-btn ld-search-btn">Search</span>
        </button>

        <label className="ld-check">
          <input type="checkbox" checked readOnly />
          Show women-only rides
        </label>
      </div>

      <section className="ld-features">
        {FEATURES.map((f) => (
          <div key={f.title} className="ld-feature">
            <div className="ld-feature-icon"><Icon d={f.icon} /></div>
            <div className="ld-feature-title">{f.title}</div>
            <p className="ld-feature-text">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="ld-footer">
        <button className="cc-btn cc-btn-block" onClick={onStart}>
          Sign in with your college email
        </button>
        <p className="ld-fine">Only @chitkara.edu.in addresses can ride.</p>
      </footer>
    </div>
  );
}

const css = `
.ld-page{min-height:100vh;background:var(--bg);color:var(--text)}

/* ---------- hero band ---------- */
.ld-band{background:var(--surface);border-bottom:1px solid var(--border);
  padding-bottom:30px}
.ld-nav{max-width:1040px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;
  padding:18px 20px}
.ld-brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;letter-spacing:-.02em}
.ld-logo{background:var(--text);color:var(--bg);border-radius:9px;width:28px;height:28px;
  display:grid;place-items:center;font-size:15px;font-weight:800;flex:none}
.ld-nav-actions{display:flex;align-items:center;gap:10px}
.ld-icon-btn{background:none;border:0;color:var(--text-2);width:34px;height:34px;
  border-radius:50%;display:grid;place-items:center;cursor:pointer}
.ld-icon-btn:hover{background:var(--surface-2);color:var(--text)}
.ld-nav-cta{display:none}
.ld-avatar{background:var(--surface-3);border:1px solid var(--border-strong);color:var(--text-2);
  width:34px;height:34px;border-radius:50%;display:grid;place-items:center;cursor:pointer}
.ld-avatar:hover{color:var(--text)}

.ld-hero{max-width:1040px;margin:0 auto;padding:18px 20px 8px;
  display:grid;grid-template-columns:1fr 1fr;gap:44px;align-items:center}
.ld-h1{font-family:'Poppins',var(--sans,inherit);font-size:44px;font-weight:800;
  letter-spacing:-.03em;line-height:1.08;margin:0}
.ld-sub{color:var(--text-2);font-size:16px;line-height:1.6;margin:18px 0 0;max-width:420px}

.ld-art{border-radius:20px;overflow:hidden;border:1px solid var(--border);
  box-shadow:var(--shadow);aspect-ratio:6/5}
.ld-photo{display:block;width:100%;height:100%;object-fit:cover}

/* ---------- search bar (sits inside the band, BlaBlaCar-style) ---------- */
.ld-search{display:flex;align-items:stretch;max-width:1040px;margin:30px auto 0;
  width:calc(100% - 40px);background:var(--bg);border:1px solid var(--border-strong);
  border-radius:var(--radius-pill);padding:6px;cursor:pointer;font-family:inherit;
  box-shadow:var(--shadow);transition:border-color .15s}
.ld-search:hover{border-color:var(--text-3)}
.ld-search-field{display:flex;flex-direction:column;justify-content:center;gap:3px;
  flex:1;text-align:left;min-width:0;padding:8px 20px}
.ld-search-field-sm{flex:0 0 auto}
.ld-search-label{font-size:10.5px;color:var(--text-3);font-weight:700;
  text-transform:uppercase;letter-spacing:.07em}
.ld-search-val{font-size:14.5px;font-weight:650;color:var(--text);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.ld-search-div{width:1px;background:var(--border);margin:8px 0;flex:none}
.ld-search-btn{flex:none;padding:0 26px;font-size:14px;border-radius:var(--radius-pill)}

.ld-check{display:flex;align-items:center;gap:9px;max-width:1040px;margin:16px auto 0;
  padding:0 20px;font-size:13px;color:var(--text-2);font-weight:500;cursor:default}
.ld-check input{width:16px;height:16px;accent-color:var(--text);margin:0}

/* ---------- feature row ---------- */
.ld-features{max-width:1040px;margin:0 auto;padding:52px 20px 8px;
  display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
.ld-feature-icon{width:48px;height:48px;border-radius:50%;background:var(--surface-2);
  border:1px solid var(--border);display:grid;place-items:center;color:var(--text);margin-bottom:14px}
.ld-feature-title{font-family:'Poppins',var(--sans,inherit);font-size:16px;font-weight:700;
  letter-spacing:-.01em;margin-bottom:7px}
.ld-feature-text{font-size:13px;color:var(--text-2);line-height:1.55;margin:0}

.ld-footer{max-width:520px;margin:20px auto 0;padding:36px 20px 48px;text-align:center}
.ld-fine{color:var(--text-3);font-size:12px;margin:12px 0 0}

@media(max-width:860px){
  .ld-hero{grid-template-columns:1fr;gap:26px}
  .ld-art{aspect-ratio:16/9}
  .ld-h1{font-size:34px}
}
@media(max-width:640px){
  .ld-nav-cta{display:none}
  .ld-search{flex-wrap:wrap;border-radius:20px;gap:4px}
  .ld-search-field{padding:10px 14px;flex:1 1 45%}
  .ld-search-div{display:none}
  .ld-search-btn{width:100%;margin:6px 4px 2px;padding:13px;text-align:center;border-radius:12px}
}
@media(max-width:480px){
  .ld-h1{font-size:28px}
  .ld-features{grid-template-columns:1fr;gap:28px}
}
`;
