import './globals.css';
import { headers } from 'next/headers';
import DeviceGuard from '../components/DeviceGuard';
import { Analytics } from '@vercel/analytics/next';
import { CartProvider } from '../contexts/CartContext';
import type { Viewport } from 'next';

export const metadata = {
  title: 'MEEDEX STORE | Quality Gadgets & Electronics',
  description: 'Home of Quality Gadgets & Electronics',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const host = (await headers()).get('host')?.split(':')[0]?.toLowerCase() ?? '';
  const skipDeviceGuard = host === 'meedex.com.ng' || host === 'www.meedex.com.ng';

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        <CartProvider>
          <DeviceGuard skip={skipDeviceGuard}>{children}</DeviceGuard>
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}