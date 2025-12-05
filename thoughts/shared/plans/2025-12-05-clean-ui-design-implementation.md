# Clean UI Design Implementation Plan

## Overview

Implement a clean, modern UI design system for Plan Smart using Inter font, indigo primary color, dark mode support, and consistent design tokens. This includes adding a navigation header and establishing a scalable design foundation.

## Current State Analysis

### What Exists:
- **Tailwind config** ([tailwind.config.ts](tailwind.config.ts)): Minimal with empty `extend: {}`
- **Global CSS** ([src/app/globals.css](src/app/globals.css)): Only Tailwind directives, no CSS variables
- **Root layout** ([src/app/layout.tsx](src/app/layout.tsx)): Basic HTML structure, no font optimization
- **UI components** ([src/components/ui/](src/components/ui/)): shadcn/ui components using semantic tokens (primary, secondary, etc.)
- **Pages**: Use hardcoded colors (gray-50, gray-600, blue-600)

### Key Gaps:
1. No custom font configuration
2. No CSS custom properties for theming
3. No dark mode support
4. No navigation component
5. No consistent layout wrapper
6. No skip-to-content accessibility link

## Desired End State

After implementation:
1. Inter font loads optimally via `next/font`
2. CSS custom properties define all colors for light/dark themes
3. Dark mode toggles via `class` strategy on `<html>`
4. Consistent navigation header appears on all pages
5. PageContainer component provides consistent page layouts
6. All pages use semantic color tokens instead of hardcoded values
7. WCAG AA accessibility compliance with skip-to-content link

### Verification:
- `npm run build` succeeds without errors
- `npm run lint` passes
- Pages render correctly in both light and dark modes
- Navigation is visible and functional on all pages
- Lighthouse accessibility score ≥ 90

## What We're NOT Doing

- Complete page redesigns (only updating colors/tokens)
- Adding new features or functionality
- Changing component APIs
- Mobile bottom navigation (desktop header only for now)
- Animation system (future enhancement)
- Full dark mode UI polish (just foundation setup)

## Implementation Approach

We'll build from the foundation up:
1. Design tokens (Tailwind + CSS variables)
2. Typography (Inter font)
3. Layout components (PageContainer, Navigation)
4. Update existing pages to use new system

---

## Phase 1: Design Tokens & CSS Variables

### Overview
Establish the design token foundation with Tailwind configuration and CSS custom properties for light/dark theme support.

### Changes Required:

#### 1. Update Tailwind Configuration
**File**: `tailwind.config.ts`

Replace the entire file with:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

#### 2. Update Global CSS with Theme Variables
**File**: `src/app/globals.css`

Replace the entire file with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Background & Foreground */
    --background: 0 0% 98%; /* neutral-50 equivalent */
    --foreground: 0 0% 9%; /* neutral-900 equivalent */

    /* Card */
    --card: 0 0% 100%;
    --card-foreground: 0 0% 9%;

    /* Popover */
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 9%;

    /* Primary - Indigo */
    --primary: 243 75% 59%; /* #4F46E5 */
    --primary-foreground: 0 0% 100%;

    /* Secondary */
    --secondary: 0 0% 96%;
    --secondary-foreground: 0 0% 9%;

    /* Muted */
    --muted: 0 0% 96%;
    --muted-foreground: 0 0% 45%;

    /* Accent */
    --accent: 0 0% 96%;
    --accent-foreground: 0 0% 9%;

    /* Destructive */
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    /* Success & Warning */
    --success: 160 84% 39%;
    --warning: 38 92% 50%;

    /* Border & Input */
    --border: 0 0% 90%;
    --input: 0 0% 90%;

    /* Ring (focus) */
    --ring: 243 75% 59%;

    /* Border Radius */
    --radius: 0.5rem;
  }

  .dark {
    /* Background & Foreground */
    --background: 0 0% 7%;
    --foreground: 0 0% 98%;

    /* Card */
    --card: 0 0% 12%;
    --card-foreground: 0 0% 98%;

    /* Popover */
    --popover: 0 0% 12%;
    --popover-foreground: 0 0% 98%;

    /* Primary - Indigo (slightly lighter for dark mode) */
    --primary: 243 75% 65%;
    --primary-foreground: 0 0% 100%;

    /* Secondary */
    --secondary: 0 0% 15%;
    --secondary-foreground: 0 0% 98%;

    /* Muted */
    --muted: 0 0% 15%;
    --muted-foreground: 0 0% 64%;

    /* Accent */
    --accent: 0 0% 15%;
    --accent-foreground: 0 0% 98%;

    /* Destructive */
    --destructive: 0 62% 50%;
    --destructive-foreground: 0 0% 100%;

    /* Success & Warning */
    --success: 160 84% 45%;
    --warning: 38 92% 55%;

    /* Border & Input */
    --border: 0 0% 20%;
    --input: 0 0% 20%;

    /* Ring */
    --ring: 243 75% 65%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `npm run build`
- [x] Lint passes: `npm run lint`
- [x] TypeScript compiles: `npm run typecheck`

#### Manual Verification:
- [ ] Page backgrounds use CSS variable colors
- [ ] Adding `class="dark"` to `<html>` switches to dark theme
- [ ] Card components render with proper backgrounds

---

## Phase 2: Typography & Font Setup

### Overview
Add Inter font via next/font for optimal loading and apply it globally.

### Changes Required:

#### 1. Update Root Layout with Inter Font
**File**: `src/app/layout.tsx`

Replace the entire file with:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Plan Smart - Retirement Planning',
  description: 'Smart retirement planning made simple',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `npm run build`
- [ ] No font loading errors in console

#### Manual Verification:
- [ ] Text renders in Inter font (visible difference from system font)
- [ ] Font loads without FOUT (Flash of Unstyled Text)
- [ ] Font weights (400, 500, 600, 700) display correctly

---

## Phase 3: Layout Components

### Overview
Create reusable layout components: Navigation header, PageContainer, and skip-to-content link.

### Changes Required:

#### 1. Create Navigation Component
**File**: `src/components/layout/navigation.tsx` (new file)

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/plans', label: 'Plans' },
];

export function Navigation() {
  const pathname = usePathname();

  // Don't show navigation on auth pages or onboarding
  const hideNavPaths = ['/auth', '/onboarding'];
  const shouldHideNav = hideNavPaths.some((path) => pathname?.startsWith(path));

  if (shouldHideNav || pathname === '/') {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-semibold text-foreground">
              Plan Smart
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname === item.href
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
```

#### 2. Create PageContainer Component
**File**: `src/components/layout/page-container.tsx` (new file)

```tsx
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  size?: 'narrow' | 'default' | 'wide';
  className?: string;
}

const sizeClasses = {
  narrow: 'max-w-md',
  default: 'max-w-2xl',
  wide: 'max-w-7xl',
};

export function PageContainer({
  children,
  size = 'wide',
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-8 sm:px-6 sm:py-12 lg:px-8',
        sizeClasses[size],
        className
      )}
    >
      {children}
    </div>
  );
}
```

#### 3. Create Skip to Content Link
**File**: `src/components/layout/skip-to-content.tsx` (new file)

```tsx
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Skip to main content
    </a>
  );
}
```

#### 4. Create Layout Barrel Export
**File**: `src/components/layout/index.ts` (new file)

```tsx
export { Navigation } from './navigation';
export { PageContainer } from './page-container';
export { SkipToContent } from './skip-to-content';
```

#### 5. Update Root Layout to Include Navigation
**File**: `src/app/layout.tsx`

Update to include Navigation and SkipToContent:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Navigation, SkipToContent } from '@/components/layout';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Plan Smart - Retirement Planning',
  description: 'Smart retirement planning made simple',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <SkipToContent />
        <Navigation />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `npm run build`
- [x] Lint passes: `npm run lint`
- [x] TypeScript compiles: `npm run typecheck`

#### Manual Verification:
- [ ] Navigation header appears on dashboard page
- [ ] Navigation is hidden on auth pages (/auth/login, /auth/signup)
- [ ] Navigation is hidden on onboarding page
- [ ] Navigation is hidden on home page (/)
- [ ] Skip to content link appears when pressing Tab on page load
- [ ] Active nav item is visually distinguished
- [ ] Sign out button works

---

## Phase 4: Update Existing Pages

### Overview
Update all existing pages to use the new design tokens and semantic colors.

### Changes Required:

#### 1. Update Home Page
**File**: `src/app/page.tsx`

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Welcome to Plan Smart
        </h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Your retirement planning journey starts here. Get personalized insights
          and build a secure financial future.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/auth/signup">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

#### 2. Update Dashboard Page
**File**: `src/app/dashboard/page.tsx`

```tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { db } from '@/db/client';
import { userProfile } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

async function getUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Check if user has completed onboarding
  const profiles = await db
    .select({ onboardingCompleted: userProfile.onboardingCompleted })
    .from(userProfile)
    .where(eq(userProfile.id, user.id))
    .limit(1);

  const profile = profiles[0];

  // Redirect to onboarding if not completed
  if (!profile || !profile.onboardingCompleted) {
    redirect('/onboarding');
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to Plan Smart
          </h1>
          <p className="text-muted-foreground">
            Your dashboard is being built. Check back soon for your retirement
            planning tools.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>Your current account information</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>Logged in as: {user.email}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
```

#### 3. Update Login Page
**File**: `src/app/auth/login/page.tsx`

```tsx
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
```

#### 4. Update Login Form (replace hardcoded colors)
**File**: `src/components/auth/login-form.tsx`

Update the link colors from `text-blue-600` to `text-primary`:

```tsx
// Line 125-130: Update forgot password link
<a
  href="/auth/forgot-password"
  className="text-sm text-primary hover:underline"
>
  Forgot password?
</a>

// Line 137-140: Update signup link
<p className="text-sm text-center text-muted-foreground">
  Don&apos;t have an account?{' '}
  <a href="/auth/signup" className="text-primary hover:underline">
    Sign up
  </a>
</p>
```

#### 5. Update Onboarding Page
**File**: `src/app/onboarding/page.tsx`

Update progress bar color from `bg-blue-600` to `bg-primary`:

```tsx
// Line 71-75: Update progress bar
<div className="h-2 w-full rounded-full bg-muted">
  <div
    className="h-2 rounded-full bg-primary transition-all duration-300"
    style={{ width: `${currentStep * 25}%` }}
  />
</div>
```

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `npm run build`
- [x] Lint passes: `npm run lint`
- [x] TypeScript compiles: `npm run typecheck`
- [x] All tests pass: `npm test -- --run`

#### Manual Verification:
- [ ] Home page displays with new styling and CTA buttons
- [ ] Dashboard uses Card component with proper theming
- [ ] Login page uses semantic colors (no hardcoded blue-600)
- [ ] Onboarding progress bar uses primary color
- [ ] All pages look correct in light mode
- [ ] Adding `dark` class to html shows dark mode colors

---

## Phase 5: Dark Mode Toggle (Optional Enhancement)

### Overview
Add a theme toggle component for users to switch between light and dark modes.

### Changes Required:

#### 1. Install next-themes
**Command**: `npm install next-themes`

#### 2. Create Theme Provider
**File**: `src/components/providers/theme-provider.tsx` (new file)

```tsx
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

#### 3. Create Theme Toggle Component
**File**: `src/components/layout/theme-toggle.tsx` (new file)

```tsx
'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Sun className="h-5 w-5" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

#### 4. Update Layout Barrel Export
**File**: `src/components/layout/index.ts`

```tsx
export { Navigation } from './navigation';
export { PageContainer } from './page-container';
export { SkipToContent } from './skip-to-content';
export { ThemeToggle } from './theme-toggle';
```

#### 5. Update Root Layout with ThemeProvider
**File**: `src/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Navigation, SkipToContent } from '@/components/layout';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Plan Smart - Retirement Planning',
  description: 'Smart retirement planning made simple',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SkipToContent />
          <Navigation />
          <main id="main-content">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

#### 6. Add Theme Toggle to Navigation
**File**: `src/components/layout/navigation.tsx`

Add ThemeToggle next to Sign out button:

```tsx
import { ThemeToggle } from './theme-toggle';

// In the return JSX, update the right side:
<div className="flex items-center gap-2">
  <ThemeToggle />
  <form action="/api/auth/logout" method="POST">
    <button
      type="submit"
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      Sign out
    </button>
  </form>
</div>
```

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `npm run build`
- [x] Lint passes: `npm run lint`
- [x] All tests pass: `npm test -- --run`

#### Manual Verification:
- [ ] Theme toggle button appears in navigation
- [ ] Clicking toggle switches between light and dark modes
- [ ] Theme preference persists across page refreshes
- [ ] System theme preference is respected by default
- [ ] No hydration mismatch errors in console

---

## Testing Strategy

### Unit Tests:
- Navigation component renders correctly
- PageContainer applies correct size classes
- ThemeToggle switches themes

### Integration Tests:
- Navigation visibility logic (hidden on auth pages)
- Theme persistence across navigation

### Manual Testing Steps:
1. Visit home page - verify new design with CTA buttons
2. Click "Get Started" - navigate to signup
3. Sign in with existing account
4. Verify navigation appears on dashboard
5. Toggle theme and verify colors change
6. Press Tab on any page - verify skip-to-content link appears
7. Navigate to /onboarding - verify navigation is hidden
8. Check all pages in both light and dark modes

## Performance Considerations

- Inter font loaded via `next/font` for optimal performance (no external requests)
- CSS variables enable theme switching without JavaScript (SSR compatible)
- `backdrop-blur` on navigation uses GPU acceleration
- No layout shift from theme toggle (icon size consistent)

## Migration Notes

No data migrations required. This is a purely visual update.

## References

- Research document: [thoughts/shared/research/2025-12-05-clean-ui-design-website-experience.md](thoughts/shared/research/2025-12-05-clean-ui-design-website-experience.md)
- shadcn/ui theming: https://ui.shadcn.com/docs/theming
- next-themes: https://github.com/pacocoursey/next-themes
- Tailwind dark mode: https://tailwindcss.com/docs/dark-mode
