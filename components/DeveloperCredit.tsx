const DEV_WHATSAPP = '2348105333931'; // your number: digits only, country code first
const CLIENT_NAME = 'MEEDEX GADGETS';

const message = `Hello DePrince Tech, I saw a website you built for ${CLIENT_NAME} and I would like to discuss a custom web app or software solution for my brand/business.`;
export default function DeveloperCredit({
  onDark = false,
  clearFloating = false,
}: {
  onDark?: boolean;
  clearFloating?: boolean; // adds space below so a floating widget doesn't cover the credit
}) {
  return (
    <p
      style={{
        textAlign: 'center',
        fontSize: 14,
        color: onDark ? 'rgba(248,250,252,0.65)' : '#666',
        padding: clearFloating ? '16px 0 96px' : '16px 0',
      }}
    >
      Designed &amp; Built by{' '}
      <a
        href={`https://wa.me/${DEV_WHATSAPP}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: onDark ? '#FBBF24' : '#007bff', textDecoration: 'none', fontWeight: 'bold' }}
      >
        DePrince Tech
      </a>
    </p>
  );
}