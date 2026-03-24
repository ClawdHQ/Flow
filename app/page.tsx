import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Waves,
  Zap,
  Shield,
  Users,
  ArrowRight,
  TrendingUp,
  Clock,
  Lock,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="relative">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-flow-violet/10 blur-[120px] animate-float" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-flow-cyan/10 blur-[100px] animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full bg-flow-emerald/5 blur-[80px]" />
      </div>

      {/* Hero */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-24 pb-32 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          <Badge variant="outline" className="mb-6 px-4 py-1.5 text-xs border-primary/30 backdrop-blur-sm">
            <Waves className="h-3 w-3 mr-1.5 text-primary" />
            Rumble-Native Autonomous Agent
          </Badge>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            <span className="gradient-text">1,000 fans</span>
            <br />
            <span className="text-foreground">always outweigh</span>
            <br />
            <span className="text-muted-foreground">one whale</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Flow transforms every viewer&apos;s watch time into a programmable USD₮ tip,
            then quadratically multiplies community support. Autonomous.
            Onchain. Powered by{' '}
            <span className="text-foreground font-medium">Tether WDK</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button variant="glow" size="xl" className="group">
                Connect Wallet
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="xl">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[
            { label: 'Quadratic Matching', value: '√x²', icon: TrendingUp },
            { label: 'Round Cycle', value: '24h', icon: Clock },
            { label: 'Sybil Protected', value: '2-layer', icon: Shield },
            { label: 'Agent-Signed', value: 'Trustless', icon: Lock },
          ].map(stat => (
            <div key={stat.label} className="glass rounded-xl p-4 text-center">
              <stat.icon className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="text-lg font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          How <span className="gradient-text">Flow</span> Works
        </h2>
        <p className="text-muted-foreground text-center max-w-xl mx-auto mb-16">
          Three autonomous mechanisms that turn passive viewers into economic participants
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Zap,
              title: 'Watch-Time Auto-Tips',
              description:
                'When a viewer hits 50% watch time, Flow fires a $0.10 USD₮ micro-tip. At 100%, a $0.25 bonus. The viewer never pauses. The creator earns.',
              gradient: 'from-violet-500/20 to-violet-500/5',
            },
            {
              icon: Users,
              title: 'Quadratic Matching',
              description:
                '1,000 fans tipping $0.10 each = quadratic score of 1,000,000. One whale tipping $100 = score of 100. Breadth beats depth by 10,000×.',
              gradient: 'from-cyan-500/20 to-cyan-500/5',
            },
            {
              icon: Shield,
              title: 'Autonomous Settlement',
              description:
                'Every 24 hours: lock → sybil analysis → LLM review → agent-signed allocation → fund distribution → IPFS archival. No human intervention.',
              gradient: 'from-emerald-500/20 to-emerald-500/5',
            },
          ].map(feature => (
            <Card key={feature.title} className="bg-transparent border-border/50 overflow-hidden group hover:border-primary/30 transition-colors duration-300">
              <div className={`h-1 bg-gradient-to-r ${feature.gradient}`} />
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Quadratic Demo */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 max-w-7xl mx-auto">
        <div className="glass rounded-2xl p-8 sm:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
            The <span className="gradient-text">Quadratic</span> Difference
          </h2>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Community */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Users className="h-4 w-4 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-emerald-400">Community Power</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">1,000 fans × $0.10</span>
                  <span className="font-mono text-foreground">$100 total</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full w-full transition-all duration-1000" />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quadratic Score</span>
                  <span className="font-mono font-bold text-emerald-400">1,000,000</span>
                </div>
              </div>
            </div>

            {/* Whale */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-amber-400" />
                </div>
                <h3 className="font-semibold text-amber-400">Whale Capital</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">1 whale × $100</span>
                  <span className="font-mono text-foreground">$100 total</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-1000"
                    style={{ width: '0.01%', minWidth: '4px' }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quadratic Score</span>
                  <span className="font-mono font-bold text-amber-400">100</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Same total money. <span className="text-foreground font-medium">10,000× more matching signal</span> from the community.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-4 sm:px-6 lg:px-8 py-8 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold gradient-text">Flow</span>
            <span className="text-xs text-muted-foreground">
              Autonomous Quadratic Tipping for Rumble
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span>Powered by Tether WDK</span>
            <span>Apache 2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
