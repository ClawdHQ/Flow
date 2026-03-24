'use client';

import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Settings,
  BarChart3,
  Tv,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const sidebarLinks = [
  { href: '/creator', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/creator/settings', label: 'Settings', icon: Settings },
  { href: '/creator/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/creator/rumble', label: 'Rumble', icon: Tv },
  { href: '/creator/withdraw', label: 'Withdraw', icon: CreditCard },
];

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="lg:w-56 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {sidebarLinks.map(link => {
              const Icon = link.icon;
              const active = link.exact
                ? pathname === link.href
                : pathname?.startsWith(link.href);

              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={active ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-2 text-sm',
                      active && 'bg-primary/15 text-primary hover:bg-primary/20'
                    )}
                    size="sm"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
