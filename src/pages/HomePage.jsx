import { Link } from "react-router-dom";
import { useLove } from "../LoveContext";

const features = [
  {
    number: "01",
    label: "Keep close",
    title: "Your memories",
    description:
      "Save the little moments, favorite photos, and promises you never want to forget.",
    link: "/memories",
    linkText: "Visit your memories",
  },
  {
    number: "02",
    label: "Say it your way",
    title: "Love messages",
    description:
      "Find the right words, discover a new message, and share a little love anytime.",
    link: "/messages",
    linkText: "Find a message",
  },
  {
    number: "03",
    label: "Made for two",
    title: "Heart maker",
    description:
      "Bring your names together in a glowing heart made just for the two of you.",
    link: "/heart-maker",
    linkText: "Make your heart",
  },
];

function HomePage() {
  const { namesLabel } = useLove();

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="home-eyebrow">
            <span aria-hidden="true">✦</span> A little place for your love story
          </p>
          <h1 id="home-title">
            The best love stories
            <br />
            are made of <em>little things.</em>
          </h1>
          <p className="home-intro">
            A space to celebrate the moments, words, and memories that make your
            story yours.
          </p>
          <p className="home-couple-label">{namesLabel}</p>
          <div className="home-actions">
            <Link className="home-primary-button" to="/memories">
              Explore your memories <span aria-hidden="true">↗</span>
            </Link>
            <Link className="home-text-link" to="/heart-maker">
              Create your heart <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className="home-hero-art" aria-label={`A heart made for ${namesLabel}`}>
          <div className="home-orbit home-orbit-outer" />
          <div className="home-orbit home-orbit-inner" />
          <span className="home-art-sparkle home-art-sparkle-one" aria-hidden="true">
            ✦
          </span>
          <span className="home-art-sparkle home-art-sparkle-two" aria-hidden="true">
            ✧
          </span>
          <div className="home-heart">
            <svg
              aria-hidden="true"
              viewBox="0 0 120 110"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M60 101S8 71 8 35C8 16 22 5 39 5c10 0 17 6 21 15C64 11 72 5 82 5c17 0 30 12 30 30 0 36-52 66-52 66Z"
                fill="url(#home-heart-fill)"
              />
              <defs>
                <linearGradient
                  id="home-heart-fill"
                  x1="15"
                  y1="7"
                  x2="108"
                  y2="105"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#FFD9E8" />
                  <stop offset="1" stopColor="#FF75A8" />
                </linearGradient>
              </defs>
            </svg>
            <span>always,</span>
            <strong>together</strong>
          </div>
          <div className="home-art-note">
            <span className="home-note-heart" aria-hidden="true">♥</span>
            <span>
              <strong>Just the two of you</strong>
              <small>A story worth keeping</small>
            </span>
          </div>
        </div>
      </section>

      <section className="home-discover" aria-labelledby="home-discover-title">
        <div className="home-section-heading">
          <div>
            <p className="home-eyebrow">Made with love</p>
            <h2 id="home-discover-title">A little something for every moment.</h2>
          </div>
          <p>Pick up where your heart takes you.</p>
        </div>

        <div className="home-feature-grid">
          {features.map((feature) => (
            <article className="home-feature-card" key={feature.number}>
              <div className="home-feature-topline">
                <span>{feature.label}</span>
                <span className="home-feature-number">{feature.number}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <Link to={feature.link}>
                {feature.linkText} <span aria-hidden="true">↗</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <span aria-hidden="true">♥</span> Made for {namesLabel}
      </footer>
    </div>
  );
}

export default HomePage;
