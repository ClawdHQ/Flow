'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  User,
  Waves,
  LogOut,
  Wallet,
  ArrowRightLeft,
  CreditCard,
} from 'lucide-react';
import { cn, shortenAddress } from '@/lib/utils';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/creator', label: 'Creator Portal', icon: User },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/bridge', label: 'Bridge', icon: ArrowRightLeft },
  { href: '/fiat', label: 'Fiat', icon: CreditCard },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Hide navbar on overlay pages
  if (pathname?.startsWith('/overlay')) return null;

  return (
    <header className="sticky top-0 z-50 w-full glass">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 group-hover:bg-primary/30 transition-colors">
            <Waves className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold gradient-text tracking-tight">Flow</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
            Rumble
          </Badge>
        </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname?.startsWith(link.href + '/');
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'gap-2',
                    active && 'bg-primary/15 text-primary hover:bg-primary/20'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Auth */}
        {/* Auth + mobile toggle */}
        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <div className="hidden md:flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium">{user.username}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {shortenAddress(user.address)}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Link href="/login" className="hidden md:inline-flex">
              <Button variant="glow" size="sm" className="gap-2">
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </Button>
            </Link>
          )}
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(prev => !prev)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav panel */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-sm px-4 py-3 space-y-1">
          {navLinks.map(link => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname?.startsWith(link.href + '/');
            return (
              <Link key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2',
                    active && 'bg-primary/15 text-primary hover:bg-primary/20'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
          <div className="pt-2 border-t border-border/50">
            {isAuthenticated && user ? (
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{user.username}</p>
                  <p className="text-xs text-muted-foreground font-mono">{shortenAddress(user.address)}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { logout(); setIsMenuOpen(false); }}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                <Button variant="glow" size="sm" className="w-full gap-2">
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
