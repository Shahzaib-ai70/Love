import { memoryGallery, memoryLetters, memoryMoments } from "../loveData";

function MemoriesPage() {
  return (
    <section className="page-stack section-block">
      <div className="section-heading">
        <p className="section-tag">Our memories</p>
        <h2>Khadija and Shahzaib love memories</h2>
        <p className="copy-status">
          A romantic page filled with long loving memories, emotional notes, and
          beautiful picture cards.
        </p>
      </div>

      <div className="memory-list">
        {memoryMoments.map((item) => (
          <article className="memory-card" key={item.title}>
            <div className="memory-icon">♥</div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>

      <div className="memory-letter-list">
        {memoryLetters.map((item) => (
          <article className="memory-letter-card" key={item.title}>
            <p className="section-tag">Long loving message</p>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>

      <div className="section-heading">
        <p className="section-tag">Loving pictures</p>
        <h2>Picture memories</h2>
      </div>

      <div className="memory-gallery">
        {memoryGallery.map((item) => (
          <article className="gallery-card" key={item.title}>
            <img src={item.image} alt={item.alt} loading="lazy" />
            <div className="gallery-copy">
              <h3>{item.title}</h3>
              <p>{item.caption}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default MemoriesPage;
