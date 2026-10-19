import Image from 'next/image';

export const metadata = {
  title: 'MEEDEX GADGETS | Coming Soon',
  description: 'Quality gadgets and electronics. Our online store is opening soon.',
};

/* ------------------------------------------------------------------
   EDIT THIS SECTION. Change any text or color, save, and you're done.
------------------------------------------------------------------- */
const CONTENT = {
  brand: 'MEEDEX GADGETS',
  badge: 'Opening soon',
  headline: 'Great gadgets are on their way.',
  subheadline:
    'We are putting the final touches on our online store. Quality gadgets and accessories, with easy online checkout, all in one place.',
  highlights: ['Quality gadgets', 'Smart accessories', 'Easy online checkout'],
  buttonLabel: 'Chat with us on WhatsApp',
  // Use the international format with no + or spaces, e.g. 2348012345678
  whatsappNumber: '2349067911723',
  whatsappText: 'Hello MEEDEX GADGETS, I would like to know when you open.',
};

const COLORS = {
  navy: '#061A40', // deep background
  blue: '#1D4ED8', // main brand blue
  sky: '#38BDF8', // light blue glow
  accent: '#FBBF24', // warm gold for the badge and button
  text: '#F8FAFC', // near white
};
/* ---------------------------------------------------------------- */

export default function ComingSoon() {
  const whatsappHref = `https://wa.me/${CONTENT.whatsappNumber}?text=${encodeURIComponent(
    CONTENT.whatsappText
  )}`;

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        padding: '32px 20px',
        textAlign: 'center',
        color: COLORS.text,
        background: `linear-gradient(160deg, ${COLORS.navy} 0%, #0B2A6F 55%, ${COLORS.blue} 120%)`,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes cs-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-24px) } }
        @keyframes cs-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
        @keyframes cs-pulse { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: .4; transform: scale(1.5) } }
        .cs-orb { position: absolute; border-radius: 9999px; filter: blur(70px); animation: cs-float 9s ease-in-out infinite; pointer-events: none; }
        .cs-rise { animation: cs-rise .8s ease both; }
        .cs-btn { transition: transform .2s ease, box-shadow .2s ease; }
        .cs-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(251,191,36,.35); }
        @media (prefers-reduced-motion: reduce) {
          .cs-orb, .cs-rise, .cs-dot { animation: none !important; }
        }
      `}</style>

      {/* Soft glowing background shapes */}
      <div
        className="cs-orb"
        style={{ width: 340, height: 340, top: -80, left: -80, background: COLORS.sky, opacity: 0.28 }}
      />
      <div
        className="cs-orb"
        style={{
          width: 400,
          height: 400,
          bottom: -120,
          right: -100,
          background: COLORS.blue,
          opacity: 0.55,
          animationDelay: '-4s',
        }}
      />

      <section className="cs-rise" style={{ position: 'relative', maxWidth: 640, width: '100%' }}>
        {/* Logo (put your file at public/logo.png) */}
        <div
          style={{
            width: 112,
            height: 112,
            margin: '0 auto 24px',
            borderRadius: 28,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.25)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Image src="/logo.png" alt={`${CONTENT.brand} logo`} width={80} height={80} priority />
        </div>

        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: COLORS.accent,
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.4)',
          }}
        >
          <span
            className="cs-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              background: COLORS.accent,
              animation: 'cs-pulse 1.8s ease-in-out infinite',
            }}
          />
          {CONTENT.badge}
        </div>

        <h1
          style={{
            margin: '20px 0 0',
            fontSize: 'clamp(2rem, 7vw, 3.5rem)',
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}
        >
          {CONTENT.headline}
        </h1>

        <p
          style={{
            margin: '18px auto 0',
            maxWidth: 520,
            fontSize: 'clamp(1rem, 3.5vw, 1.15rem)',
            lineHeight: 1.6,
            opacity: 0.85,
          }}
        >
          {CONTENT.subheadline}
        </p>

        {/* Highlights */}
        <ul
          style={{
            listStyle: 'none',
            margin: '28px 0 0',
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {CONTENT.highlights.map((item) => (
            <li
              key={item}
              style={{
                padding: '8px 16px',
                borderRadius: 9999,
                fontSize: 14,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {item}
            </li>
          ))}
        </ul>

        {/* WhatsApp button */}
        <a
          className="cs-btn"
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 32,
            padding: '14px 28px',
            borderRadius: 9999,
            fontSize: 16,
            fontWeight: 700,
            textDecoration: 'none',
            color: COLORS.navy,
            background: COLORS.accent,
          }}
        >
          {CONTENT.buttonLabel}
        </a>

        <p style={{ marginTop: 40, fontSize: 13, opacity: 0.6 }}>
          &copy; {new Date().getFullYear()} {CONTENT.brand}
        </p>
      </section>
    </main>
  );
}