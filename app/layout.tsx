// app/layout.tsx
import './globals.css';
import DeviceGuard from '../components/DeviceGuard';
import { Analytics } from '@vercel/analytics/next';
import { CartProvider } from '../contexts/CartContext';
import type { Viewport } from 'next';

export const metadata = {
  title: 'MEEDEX GADGETS',
  description: 'Home of Quality Gadgets & Electronics',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        <CartProvider>
          <DeviceGuard>{children}</DeviceGuard>
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}