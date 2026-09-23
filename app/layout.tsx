import './globals.css';
import DeviceGuard from '../components/DeviceGuard';
import { Analytics } from '@vercel/analytics/next';
import type { Viewport } from 'next';

export const metadata = {
  title: 'DEPRINCE POS & Inventory',
  description: 'Point of Sale system for DEPRINCE',
};

// Setting a explicit min-width layout viewport instead of locking to the literal physical screen width
export const viewport: Viewport = {
  width: 1024, // Forces the browser canvas to treat the screen as a 1024px desktop monitor
  initialScale: 0.8, // Slightly zooms out initially so the 1024px layout fits mobile displays
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-w-[1024px] overflow-x-auto">
        <DeviceGuard>{children}</DeviceGuard>
        <Analytics />
      </body>
    </html>
  );
}