import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FloatingHearts from "../FloatingHearts";
import HeartCanvas from "../HeartCanvas";
import { useLove } from "../LoveContext";

function IntroPage() {
  const navigate = useNavigate();
  const { yourName, loverName, setNames } = useLove();
  const [localYourName, setLocalYourName] = useState(yourName);
  const [localLoverName, setLocalLoverName] = useState(loverName);
  const previewLabel = useMemo(
    () =>
      `${localYourName.trim() || "Your Name"} + ${localLoverName.trim() || "Partner Name"}`,
    [localLoverName, localYourName]
  );

  const handleSubmit = (event) => {
    event.preventDefault();

    setNames({
      yourName: localYourName.trim(),
      loverName: localLoverName.trim(),
    });

    navigate("/home");
  };

  return (
    <div className="page-shell">
      <FloatingHearts />
      <div className="glow glow-one" />
      <div className="glow glow-two" />

      <main className="intro-page intro-v2">
        <header className="intro-brandbar">
          <div className="intro-wordmark">
            <span className="intro-wordmark-icon" aria-hidden="true">L</span>
            <span>love, in bloom<small>A little world for two</small></span>
          </div>
          <span className="intro-private-note">
            <span aria-hidden="true" />
            YOUR PRIVATE LOVE SPACE
          </span>
        </header>

        <section className="intro-story">
          <p className="intro-kicker"><span>01</span> YOUR STORY STARTS HERE</p>
          <h1>Make a little <em>world</em> for the two of you.</h1>
          <p className="intro-description">
            Add your names and step into a space made for your favorite moments,
            messages, and memories together.
          </p>

          <form className="intro-form intro-form-v2" onSubmit={handleSubmit}>
            <label>
              <span className="intro-field-number">01</span>
              Your name
              <input
                type="text"
                value={localYourName}
                onChange={(event) => setLocalYourName(event.target.value)}
                placeholder="e.g. Alex"
              />
            </label>

            <label>
              <span className="intro-field-number">02</span>
              Their name
              <input
                type="text"
                value={localLoverName}
                onChange={(event) => setLocalLoverName(event.target.value)}
                placeholder="e.g. Jamie"
              />
            </label>

            <button className="primary-button intro-submit" type="submit">
              <span>Enter your love space</span>
              <span className="intro-submit-arrow" aria-hidden="true">↗</span>
            </button>
          </form>

          <p className="intro-footnote">
            <span aria-hidden="true">♥</span>
            Just for you two. Your names stay in this browser.
          </p>
        </section>

        <section className="intro-scene" aria-label={`A live heart preview for ${previewLabel}`}>
          <div className="intro-scene-topline">
            <span>MADE OF LITTLE THINGS</span>
            <span className="intro-scene-index">NO. 01</span>
          </div>
          <div className="intro-scene-orbit intro-scene-orbit-one" />
          <div className="intro-scene-orbit intro-scene-orbit-two" />
          <span className="intro-scene-sparkle intro-scene-sparkle-one" aria-hidden="true">✦</span>
          <span className="intro-scene-sparkle intro-scene-sparkle-two" aria-hidden="true">✧</span>
          <HeartCanvas theme="pink" density={1.05} />
          <div className="intro-couple-card">
            <span className="intro-couple-icon" aria-hidden="true">♥</span>
            <span>
              <small>YOUR STORY, TOGETHER</small>
              <strong>{previewLabel}</strong>
            </span>
            <span className="intro-live-indicator">LIVE</span>
          </div>
          <div className="intro-scene-caption">
            <span>Every love story is lovely</span>
            <span>when it's yours.</span>
          </div>
        </section>

        <footer className="intro-bottomline">
          <span>LOVE IS IN THE LITTLE DETAILS</span>
          <span>MADE WITH CARE <span aria-hidden="true">♥</span></span>
        </footer>
      </main>
    </div>
  );
}

export default IntroPage;
