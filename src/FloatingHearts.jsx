const heartItems = [
  { left: "4%", top: "10%", size: 28, delay: "0s", duration: "13s" },
  { left: "11%", top: "24%", size: 42, delay: "1.2s", duration: "17s" },
  { left: "18%", top: "58%", size: 60, delay: "0.8s", duration: "18s" },
  { left: "28%", top: "34%", size: 36, delay: "2.6s", duration: "15s" },
  { left: "35%", top: "72%", size: 52, delay: "0.4s", duration: "19s" },
  { left: "43%", top: "46%", size: 72, delay: "1.4s", duration: "21s" },
  { left: "51%", top: "18%", size: 30, delay: "3.2s", duration: "14s" },
  { left: "58%", top: "62%", size: 44, delay: "1s", duration: "16s" },
  { left: "66%", top: "28%", size: 56, delay: "2.1s", duration: "20s" },
  { left: "73%", top: "76%", size: 40, delay: "0.2s", duration: "17s" },
  { left: "82%", top: "16%", size: 34, delay: "2.8s", duration: "14s" },
  { left: "88%", top: "44%", size: 64, delay: "1.9s", duration: "22s" },
];

const sparkleItems = [
  { left: "3%", top: "4%", size: 5, delay: "0s" },
  { left: "9%", top: "39%", size: 6, delay: "1.2s" },
  { left: "14%", top: "82%", size: 4, delay: "3.2s" },
  { left: "22%", top: "14%", size: 7, delay: "1.8s" },
  { left: "30%", top: "52%", size: 5, delay: "0.6s" },
  { left: "37%", top: "8%", size: 6, delay: "2.2s" },
  { left: "45%", top: "66%", size: 8, delay: "1.5s" },
  { left: "49%", top: "30%", size: 4, delay: "0.9s" },
  { left: "57%", top: "10%", size: 6, delay: "2.7s" },
  { left: "63%", top: "82%", size: 5, delay: "1.1s" },
  { left: "70%", top: "54%", size: 7, delay: "2.6s" },
  { left: "76%", top: "22%", size: 5, delay: "0.3s" },
  { left: "81%", top: "70%", size: 6, delay: "3.5s" },
  { left: "89%", top: "11%", size: 7, delay: "1.7s" },
  { left: "94%", top: "47%", size: 4, delay: "2.9s" },
];

function FloatingHearts() {
  return (
    <div className="heart-overlay" aria-hidden="true">
      {heartItems.map((item, index) => (
        <span
          className="floating-heart"
          key={`heart-${index}`}
          style={{
            left: item.left,
            top: item.top,
            width: `${item.size}px`,
            height: `${item.size}px`,
            animationDelay: item.delay,
            animationDuration: item.duration,
          }}
        />
      ))}

      {sparkleItems.map((item, index) => (
        <span
          className="floating-sparkle"
          key={`sparkle-${index}`}
          style={{
            left: item.left,
            top: item.top,
            width: `${item.size}px`,
            height: `${item.size}px`,
            animationDelay: item.delay,
          }}
        />
      ))}
    </div>
  );
}

export default FloatingHearts;
