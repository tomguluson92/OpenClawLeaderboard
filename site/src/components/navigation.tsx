"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Github, ExternalLink } from "lucide-react";

export function Navigation() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="group flex items-center gap-3">
          <span className="text-3xl transition-transform group-hover:scale-110 group-hover:-rotate-6">🦞</span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-bold tracking-tight">OpenClaw</span>
            <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase hidden sm:inline">
              Leaderboard
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-2.5">
          <a
            href="https://github.com/openclaw/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-3 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:border-border"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
            <ExternalLink className="h-3 w-3 opacity-40" />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
