import { useEffect, useRef } from 'react';

// Plays a Lottie animation from /public/lottie/<name>.json (looping, SVG).
export default function Lottie({ name, className = '', loop = true }) {
  const ref = useRef(null);
  useEffect(() => {
    let anim;
    let cancelled = false;
    // Loaded lazily: the player touches <canvas> on import, which test DOMs lack.
    import('lottie-web/build/player/lottie_light')
      .then(({ default: lottie }) => {
        if (cancelled || !ref.current) return;
        anim = lottie.loadAnimation({
          container: ref.current,
          renderer: 'svg',
          loop,
          autoplay: true,
          path: `${import.meta.env.BASE_URL}lottie/${name}.json`,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; anim?.destroy(); };
  }, [name, loop]);
  return <div ref={ref} className={`lottie ${className}`} aria-hidden="true" />;
}

// The cat in a box peeks up from the bottom edge of its card a moment after
// it appears, and ducks back down while the pointer is over the card.
export function PeekingCat() {
  return <Lottie name="cat-box" className="peek-cat" />;
}

// Shown on report cards when the result is weak.
export function TryAgainCat() {
  return <Lottie name="cat-crying" className="try-again-cat" />;
}
