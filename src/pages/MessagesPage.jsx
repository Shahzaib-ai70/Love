import { useEffect, useMemo, useState } from "react";
import { createAiStyleLoveMessage, loveMessages } from "../loveData";
import { useLove } from "../LoveContext";

function MessagesPage() {
  const { namesLabel } = useLove();
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedMessage, setCopiedMessage] = useState("");
  const [variationSeed, setVariationSeed] = useState(0);
  const [generatedMessage, setGeneratedMessage] = useState(() =>
    createAiStyleLoveMessage("", namesLabel, 0)
  );

  useEffect(() => {
    setGeneratedMessage(createAiStyleLoveMessage(searchTerm, namesLabel, variationSeed));
  }, [namesLabel, searchTerm, variationSeed]);

  const filteredMessages = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    if (!normalizedTerm) {
      return loveMessages;
    }

    return loveMessages.filter((message) =>
      message.toLowerCase().includes(normalizedTerm)
    );
  }, [searchTerm]);

  const handleCopy = async (message) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedMessage("Message copied successfully.");
      window.setTimeout(() => setCopiedMessage(""), 1800);
    } catch (error) {
      console.error("Copy failed", error);
      setCopiedMessage("Copy failed. Please try again.");
    }
  };

  const handleGenerate = () => {
    setVariationSeed((currentSeed) => currentSeed + 1);
  };

  return (
    <section className="page-stack section-block">
      <div className="section-heading">
        <p className="section-tag">Messages section</p>
        <h2>Search and generate love messages</h2>
        <p className="copy-status">
          Write your message command once and get one generated love message, then
          browse the message library below.
        </p>
      </div>

      <div className="message-tools">
        <label className="message-search">
          Write your command
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Example: make a long emotional message for my wife KHADIJA"
          />
        </label>

        <button className="primary-button" type="button" onClick={handleGenerate}>
          Generate New Message
        </button>
      </div>

      <article className="generated-message-card">
        <p className="section-tag">Generated message</p>
        <h3>Fresh romantic message for {namesLabel}</h3>
        <p>{generatedMessage}</p>
        <button type="button" onClick={() => handleCopy(generatedMessage)}>
          Copy Long Message
        </button>
      </article>

      <p className="copy-status">
        Type your command and the message updates instantly. Click the button for a
        different version.
      </p>

      <div className="section-heading">
        <p className="section-tag">Message library</p>
        <h2>100+ romantic messages ready to share</h2>
      </div>

      <label className="message-search message-search-wide">
        Search saved love messages
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by love, forever, peace, loyal, miss you..."
        />
      </label>

      <div className="message-count">
        Showing {filteredMessages.length} of {loveMessages.length} love messages
      </div>

      <div className="message-list">
        {filteredMessages.map((message) => (
          <article className="message-card" key={message}>
            <p>{message}</p>
            <button type="button" onClick={() => handleCopy(message)}>
              Copy Message
            </button>
          </article>
        ))}
      </div>

      <p className="copy-status">{copiedMessage || "Tap any button to copy a message."}</p>
    </section>
  );
}

export default MessagesPage;
