'use client'; // Error boundaries must be Client Components

import ErrorState from '@/components/ErrorState';

// Shown inside the app layout, so the sidebar stays usable while the page recovers.
export default function AppError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState {...props} />;
}
