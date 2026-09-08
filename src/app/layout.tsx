import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Relay — Every row, accounted for.', description: 'From messy customer data to a reliable import.' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
