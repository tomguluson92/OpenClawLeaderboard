"use client";

export function DinqLink({ username }: { username: string }) {
  return (
    <a
      href={`https://analysis.dinq.me/github?user=${username}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center shrink-0 rounded-md transition-all hover:scale-110"
      title={`View ${username} on DINQ`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm"
      >
        <rect width="32" height="32" rx="6" className="fill-foreground/90" />
        <text
          x="16"
          y="22.5"
          textAnchor="middle"
          className="fill-background"
          fontSize="18"
          fontWeight="800"
          fontFamily="system-ui, sans-serif"
        >
          D
        </text>
      </svg>
    </a>
  );
}
