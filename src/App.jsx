import { useState } from "react";
import AuthFlow from "./AuthFlow";
import RidesFeed from "./RidesFeed";
import PostRide from "./PostRide";
import MyRides from "./MyRides";
import Profile from "./Profile";

const TABS = [
  { key: "rides", label: "Rides", icon: "⇄" },
  { key: "post", label: "Post", icon: "＋" },
  { key: "myrides", label: "My Rides", icon: "≣" },
  { key: "profile", label: "Profile", icon: "◑" },
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
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? "on" : ""}`}
              onClick={() => setTab(t.key)} aria-current={tab === t.key ? "page" : undefined}>
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
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
.app-shell{min-height:100vh;background:#0e1512}
.app-main{padding-bottom:78px}
.tabbar{position:fixed;left:0;right:0;bottom:0;background:#121b16;
  border-top:1px solid #24332b;z-index:40}
.tabbar-inner{max-width:640px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr)}
.tab{background:none;border:0;cursor:pointer;padding:9px 0 calc(9px + env(safe-area-inset-bottom));
  display:flex;flex-direction:column;align-items:center;gap:3px;color:#6d7f74}
.tab.on{color:#5fd08a}
.tab-icon{font-size:19px;line-height:1}
.tab-label{font-size:11px;font-weight:600;letter-spacing:.02em}
.tab:active{transform:scale(.94)}
`;
