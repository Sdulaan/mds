// Shared by the server layout and the client toggle. Keep this out of 'use client'
// files: importing a value from a client module into a server component yields a
// client reference, not the value.
export const THEME_COOKIE = 'theme';
export type Theme = 'light' | 'dark';
