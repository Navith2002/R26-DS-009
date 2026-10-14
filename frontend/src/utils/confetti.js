const COLORS = ['#e8711a', '#f4a62a', '#74ac3a', '#1f7a3f', '#2f8fd8'];

// Small celebratory burst from the click point (styles: .bhasha-confetti).
// Skipped when the user prefers reduced motion.
export function burstConfetti(event, count = 22) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const x = event?.clientX ?? window.innerWidth / 2;
  const y = event?.clientY ?? window.innerHeight / 2;
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'bhasha-confetti';
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.background = COLORS[i % COLORS.length];
    piece.style.setProperty('--dx', `${Math.random() * 240 - 120}px`);
    piece.style.setProperty('--dy', `${-(Math.random() * 200 + 40)}px`);
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1000);
  }
}
