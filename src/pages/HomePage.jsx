import { Link } from "react-router-dom";
import { useLove } from "../LoveContext";

function HomePage() {
  const { namesLabel } = useLove();

  return (
    <div className="page-stack">
      <header className="hero page-hero">
        <p className="eyebrow">Love home page</p>
        <h1>{namesLabel}</h1>
        <p className="hero-copy">
          This is the main home page after the intro animation. From here visitors can
          open separate pages for memories, love messages, and the heart maker.
        </p>
      </header>

      <section className="card-grid">
        <article className="feature-card">
          <h2>Memories Page</h2>
          <p>Keep sweet chat memories, favorite moments, and future promises.</p>
          <Link className="secondary-button" to="/memories">
            Open Memories
          </Link>
        </article>

        <article className="feature-card">
          <h2>Messages Page</h2>
          <p>Give visitors loving messages they can copy and send to their partners.</p>
          <Link className="secondary-button" to="/messages">
            Open Messages
          </Link>
        </article>

        <article className="feature-card">
          <h2>Heart Maker Page</h2>
          <p>Generate the glowing heart again with two names inside the animation.</p>
          <Link className="secondary-button" to="/heart-maker">
            Open Heart Maker
          </Link>
        </article>
      </section>
    </div>
  );
}

export default HomePage;
