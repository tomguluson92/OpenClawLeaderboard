"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Github, ExternalLink } from "lucide-react";

export function Navigation() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg">
          <span className="text-2xl">🦞</span>
          <span>OpenClaw</span>
          <span className="text-muted-foreground font-normal text-sm hidden sm:inline">
            Leaderboard
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/openclaw/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
            <ExternalLink className="h-3 w-3 opacity-50" />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
