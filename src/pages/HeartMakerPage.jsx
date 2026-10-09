import HeartCanvas from "../HeartCanvas";
import { useLove } from "../LoveContext";

function HeartMakerPage() {
  const { yourName, loverName, namesLabel, setNames } = useLove();

  return (
    <section className="page-stack section-block heart-maker-page">
      <div className="section-heading">
        <p className="section-tag">Live heart maker</p>
        <h2>Create hearts with lovers names</h2>
      </div>

      <div className="heart-layout">
        <div className="input-panel">
          <label>
            Your name
            <input
              type="text"
              value={yourName}
              onChange={(event) =>
                setNames((currentNames) => ({
                  ...currentNames,
                  yourName: event.target.value,
                }))
              }
              placeholder="Enter your name"
            />
          </label>

          <label>
            Lover name
            <input
              type="text"
              value={loverName}
              onChange={(event) =>
                setNames((currentNames) => ({
                  ...currentNames,
                  loverName: event.target.value,
                }))
              }
              placeholder="Enter lover name"
            />
          </label>

          <p className="input-help">
            Change the names and watch the animated heart update live.
          </p>
        </div>

        <div className="heart-preview">
          <HeartCanvas theme="pink" density={1.05} />
          <div className="heart-text">
            <span>Forever Love</span>
            <strong>{namesLabel}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeartMakerPage;
