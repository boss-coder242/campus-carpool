import { useState } from "react";
import AuthFlow from "./AuthFlow";
import RidesFeed from "./RidesFeed";
import PostRide from "./PostRide";
import MyRides from "./MyRides";
import Profile from "./Profile";

/* Inline stroke icons — no icon dependency, inherit currentColor. */
const Icon = ({ d, filled }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
    stroke="currentColor" strokeWidth={filled ? 2.4 : 1.9}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const ICONS = {
  rides: <><path d="M3 17h18" /><path d="M5 17V9l2-4h10l2 4v8" /><circle cx="7.5" cy="17.5" r="1.6" /><circle cx="16.5" cy="17.5" r="1.6" /></>,
  post: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  myrides: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
  profile: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
};

const TABS = [
  { key: "rides", label: "Rides" },
  { key: "post", label: "Post" },
  { key: "myrides", label: "My Rides" },
  { key: "profile", label: "Profile" },
];

function Shell() {
  const [tab, setTab] = useState("rides");

  return (
    <div className="app-shell">
      <style>{css}</style>

      <main className="app-main">
        {tab === "rides" && <RidesFeed />}
        {tab === "post" && <PostRide onPosted={() => setTab("myrides")} />}
        {tab === "myrides" && <MyRides />}
        {tab === "profile" && <Profile />}
      </main>

      <nav className="tabbar" aria-label="Primary">
        <div className="tabbar-inner">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button key={t.key} className={`tab ${on ? "on" : ""}`}
                onClick={() => setTab(t.key)} aria-current={on ? "page" : undefined}>
                <Icon d={ICONS[t.key]} filled={on} />
                <span className="tab-label">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthFlow>
      <Shell />
    </AuthFlow>
  );
}

const css = `
.app-shell{min-height:100vh;background:var(--bg)}
.app-main{padding-bottom:86px;animation:appIn .2s ease}
@keyframes appIn{from{opacity:0}to{opacity:1}}

.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:40;
  background:rgba(10,10,11,.86);backdrop-filter:blur(16px);
  border-top:1px solid var(--border)}
.tabbar-inner{max-width:620px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr)}
.tab{background:none;border:0;cursor:pointer;font-family:inherit;
  padding:11px 0 calc(11px + env(safe-area-inset-bottom));
  display:flex;flex-direction:column;align-items:center;gap:5px;
  color:var(--text-3);transition:color .15s}
.tab.on{color:var(--text)}
.tab:active{transform:scale(.93)}
.tab-label{font-size:11px;font-weight:600;letter-spacing:.01em}
`;
