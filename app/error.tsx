'use client'; // Error boundaries must be Client Components

import ErrorState from '@/components/ErrorState';

// Fallback for pages outside the app layout (e.g. sign-in) and errors in the app layout itself.
export default function RootError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState {...props} />;
}
