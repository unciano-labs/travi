import type { Metadata } from 'next';

// Booking review, payment and confirmation pages are private to one traveler: keep them out of
// search indexes (robots.txt also disallows /tours/*/booking/).
export const metadata: Metadata = {
  title: 'Your booking | Travi',
  robots: { index: false, follow: false, nocache: true },
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
