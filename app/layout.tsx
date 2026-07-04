import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "CSPM | Cloud Security Posture Management",
  description: "Monitor and remediate cloud security compliance across your AWS accounts with AI-powered insights.",
};

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (clerkKey) {
    return <ClerkProvider publishableKey={clerkKey}>{children}</ClerkProvider>;
  }
  // Dev fallback: render without auth when Clerk key is not configured
  return <>{children}</>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="antialiased">
        <AuthWrapper>{children}</AuthWrapper>
      </body>
    </html>
  );
}
