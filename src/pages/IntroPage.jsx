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

      <div className="intro-page">
        <div className="intro-copy">
          <p className="eyebrow">Love intro</p>
          <h1>Write two names and open your love page</h1>
          <p className="hero-copy">
            The heart updates live while you type.
          </p>

          <form className="intro-form" onSubmit={handleSubmit}>
            <label>
              Your name
              <input
                type="text"
                value={localYourName}
                onChange={(event) => setLocalYourName(event.target.value)}
                placeholder="Write your name"
              />
            </label>

            <label>
              Lover name
              <input
                type="text"
                value={localLoverName}
                onChange={(event) => setLocalLoverName(event.target.value)}
                placeholder="Write lover name"
              />
            </label>

            <button className="primary-button" type="submit">
              Open Website
            </button>
          </form>
        </div>

        <div className="intro-animation-card">
          <div className="intro-heart-stage">
            <HeartCanvas theme="pink" density={1.05} />
            <div className="heart-text intro-heart-text">
              <span>Live Preview</span>
              <strong>{previewLabel}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntroPage;
