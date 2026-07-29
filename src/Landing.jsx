/*
  Pre-login marketing splash — shown to signed-out visitors before the
  email step. Everything here is decorative: there is no data to search
  without an account (RLS requires `authenticated`), so every control
  just leads into the sign-in flow via onStart().
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
    title: "Verified students only",
    text: "Every rider signs in with a @chitkara.edu.in email. Ratings and reviews after every ride.",
  },
];

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export default function Landing({ onStart }) {
  return (
    <div className="ld-page">
      <style>{css}</style>

      <header className="ld-nav">
        <div className="ld-brand">
          <span className="ld-logo">⇄</span>
          <span>Campus Carpool</span>
        </div>
        <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={onStart}>Sign in</button>
      </header>

      <section className="ld-hero">
        <div className="ld-hero-txt">
          <h1 className="ld-h1">Share the ride.<br />Split the fare.</h1>
          <p className="ld-sub">
            The carpool board built for Chitkara students — post an empty seat
            or find one, anywhere between campus and home.
          </p>
          <div className="ld-cta-row">
            <button className="cc-btn cc-btn-block" onClick={onStart}>Get started</button>
          </div>
          <p className="ld-fine">Only @chitkara.edu.in emails can sign in.</p>
        </div>

        <div className="ld-art" aria-hidden="true">
          <div className="ld-art-glow" />
          <div className="ld-art-card">
            <div className="ld-art-row">
              <span className="ld-art-dot" />
              <div className="ld-art-lines"><span /><span className="short" /></div>
            </div>
            <div className="ld-art-track" />
            <div className="ld-art-row">
              <span className="ld-art-dot end" />
              <div className="ld-art-lines"><span /><span className="short" /></div>
            </div>
            <div className="ld-art-foot">
              <span className="ld-art-avatar" />
              <span className="ld-art-lines"><span className="short" /></span>
              <span className="ld-art-pill" />
            </div>
          </div>
        </div>
      </section>

      {/* decorative search — routes into sign-in, nothing to browse pre-login */}
      <button className="ld-search" onClick={onStart}>
        <div className="ld-search-field">
          <span className="ld-pin from" />
          <div>
            <div className="ld-search-label">From</div>
            <div className="ld-search-val">Main Gate</div>
          </div>
        </div>
        <div className="ld-search-div" />
        <div className="ld-search-field">
          <span className="ld-pin to" />
          <div>
            <div className="ld-search-label">To</div>
            <div className="ld-search-val">Panchkula</div>
          </div>
        </div>
        <span className="cc-btn ld-search-btn">Find a ride</span>
      </button>

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
        <button className="cc-btn cc-btn-ghost cc-btn-block" onClick={onStart}>
          Sign in with your college email
        </button>
      </footer>
    </div>
  );
}

const css = `
.ld-page{min-height:100vh;background:var(--bg);color:var(--text)}
.ld-nav{max-width:620px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;
  padding:20px 18px 0}
.ld-brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;letter-spacing:-.02em}
.ld-logo{background:var(--text);color:var(--bg);border-radius:9px;width:28px;height:28px;
  display:grid;place-items:center;font-size:15px;font-weight:800;flex:none}

.ld-hero{max-width:620px;margin:0 auto;padding:36px 18px 8px;display:flex;flex-direction:column;gap:28px}
.ld-h1{font-size:34px;font-weight:800;letter-spacing:-.04em;line-height:1.08;margin:0}
.ld-sub{color:var(--text-2);font-size:15px;line-height:1.55;margin:14px 0 0;max-width:440px}
.ld-cta-row{margin-top:22px}
.ld-fine{color:var(--text-3);font-size:12px;margin:10px 0 0}

/* decorative route-card illustration */
.ld-art{position:relative;height:210px;display:flex;align-items:center;justify-content:center}
.ld-art-glow{position:absolute;width:230px;height:230px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.08),transparent 70%);filter:blur(2px)}
.ld-art-card{position:relative;width:100%;max-width:320px;background:var(--surface);
  border:1px solid var(--border);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow)}
.ld-art-row{display:flex;align-items:center;gap:12px}
.ld-art-dot{width:9px;height:9px;border-radius:50%;background:var(--text);flex:none}
.ld-art-dot.end{background:var(--green)}
.ld-art-track{width:2px;height:20px;margin:2px 0 2px 4px;
  background:repeating-linear-gradient(to bottom,var(--border-strong) 0 4px,transparent 4px 8px)}
.ld-art-lines{display:flex;flex-direction:column;gap:6px;flex:1}
.ld-art-lines span{display:block;height:8px;border-radius:4px;background:var(--surface-3);width:100%}
.ld-art-lines span.short{width:55%}
.ld-art-foot{display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:14px;
  border-top:1px solid var(--border)}
.ld-art-avatar{width:26px;height:26px;border-radius:50%;background:var(--surface-3);flex:none}
.ld-art-foot .ld-art-lines{flex:1}
.ld-art-pill{width:52px;height:22px;border-radius:var(--radius-pill);background:var(--text);flex:none}

/* decorative search bar */
.ld-search{display:flex;align-items:center;gap:0;max-width:620px;margin:28px auto 0;
  width:calc(100% - 36px);background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius);padding:14px 16px;cursor:pointer;font-family:inherit;
  transition:border-color .15s}
.ld-search:hover{border-color:var(--border-strong)}
.ld-search-field{display:flex;align-items:center;gap:11px;flex:1;text-align:left;min-width:0}
.ld-pin{width:9px;height:9px;border-radius:50%;flex:none}
.ld-pin.from{background:var(--text-3)}
.ld-pin.to{background:var(--green)}
.ld-search-label{font-size:10.5px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.ld-search-val{font-size:14.5px;font-weight:600;color:var(--text)}
.ld-search-div{width:1px;height:30px;background:var(--border);margin:0 16px;flex:none}
.ld-search-btn{flex:none;padding:11px 18px;font-size:13.5px;margin-left:14px}

.ld-features{max-width:620px;margin:0 auto;padding:44px 18px 8px;
  display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.ld-feature-icon{width:44px;height:44px;border-radius:12px;background:var(--surface-2);
  border:1px solid var(--border);display:grid;place-items:center;color:var(--text);margin-bottom:12px}
.ld-feature-title{font-size:14.5px;font-weight:700;letter-spacing:-.01em;margin-bottom:6px}
.ld-feature-text{font-size:12.5px;color:var(--text-2);line-height:1.5;margin:0}

.ld-footer{max-width:620px;margin:0 auto;padding:36px 18px 44px}

@media(max-width:640px){
  .ld-search{flex-wrap:wrap;gap:12px}
  .ld-search-div{display:none}
  .ld-search-btn{width:100%;margin-left:0;text-align:center}
}
@media(max-width:480px){
  .ld-h1{font-size:28px}
  .ld-features{grid-template-columns:1fr;gap:26px}
  .ld-art{height:190px}
}
`;
