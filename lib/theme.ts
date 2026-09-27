// Shared by the server layout and client toggles. Keep this out of 'use client'
// files: importing a value from a client module into a server component yields a
// client reference, not the value.
export const THEME_COOKIE = 'theme';
export type Theme = 'light' | 'dark';

/** "collapsed" when the desktop sidebar is shrunk to icons. */
export const SIDEBAR_COOKIE = 'sidebar';
export const SIDEBAR_WIDTH = { expanded: '16.5rem', collapsed: '4.5rem' } as const;

/** Comma-separated ids of the sidebar groups the user has closed. */
export const NAV_CLOSED_COOKIE = 'nav_closed';
