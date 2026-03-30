import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dwella - The AI that runs your rentals',
  description: 'Track rent, manage tenants, and let AI handle the rest.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header>{/* Phase 16: navigation */}</header>
        <main>{children}</main>
        <footer>{/* Phase 16: footer links */}</footer>
      </body>
    </html>
  );
}
