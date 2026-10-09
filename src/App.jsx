import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useLove } from "./LoveContext";
import HeartMakerPage from "./pages/HeartMakerPage";
import HomePage from "./pages/HomePage";
import IntroPage from "./pages/IntroPage";
import MemoriesPage from "./pages/MemoriesPage";
import MessagesPage from "./pages/MessagesPage";

function SiteLayout() {
  const { namesLabel } = useLove();

  return (
    <div className="page-shell">
      <div className="glow glow-one" />
      <div className="glow glow-two" />

      <header className="site-header">
        <div>
          <p className="eyebrow">Love Memories</p>
          <h2>{namesLabel}</h2>
        </div>

        <nav className="site-nav">
          <NavLink to="/home">Home</NavLink>
          <NavLink to="/memories">Memories</NavLink>
          <NavLink to="/messages">Messages</NavLink>
          <NavLink to="/heart-maker">Heart Maker</NavLink>
        </nav>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<IntroPage />} />
      <Route element={<SiteLayout />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/memories" element={<MemoriesPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/heart-maker" element={<HeartMakerPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
