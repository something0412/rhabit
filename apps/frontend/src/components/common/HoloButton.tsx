"use client";

import { useRef, useState } from "react";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md";
  tone?: "theme" | "success" | "danger"; // theme = the theme's rainbow, success = green (Done), danger = red (Stop)
  glowSize?: number; // how big the mouse-following glow is, in px
}

// The colors for each tone. "theme" reads the theme's colors from globals.css (--holo-beam, --holo-flare).
// The glows are kept soft on purpose (half of the original Lightswind strength).
const tones = {
  theme: {
    text: "text-accent-ink",
    border: "border-accent/20",
    hoverBorder: "border-accent/40",
    beam: "var(--holo-beam)",
    flare: "var(--holo-flare)",
    halo: "var(--accent)",
  },
  success: {
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/25",
    hoverBorder: "border-emerald-500/50",
    beam: "linear-gradient(90deg, #10b981, #2dd4bf, #84cc16)",
    flare: "radial-gradient(circle, rgb(16 185 129 / 0.1) 0%, rgb(45 212 191 / 0.1) 55%, transparent 100%)",
    halo: "#10b981",
  },
  danger: {
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/25",
    hoverBorder: "border-red-500/50",
    beam: "linear-gradient(90deg, #ef4444, #fb7185, #f97316)",
    flare: "radial-gradient(circle, rgb(239 68 68 / 0.1) 0%, rgb(251 113 133 / 0.1) 55%, transparent 100%)",
    halo: "#ef4444",
  },
};

// Same sizes as the original Lightswind button
const sizeClasses = {
  sm: "px-4 py-2 text-xs rounded-lg",
  md: "px-6 py-3 text-sm rounded-xl",
};

// The app's main action button (Start day, Add, Schedule it, Buy, Save...). Based on a reUI "holo" button:
//  - a slowly spinning gradient border (faster on hover)
//  - a soft glow that follows the mouse
//  - a shine that sweeps across on hover, and a little "press" when clicked
// Colors: by default from the theme (globals.css), so it matches every theme and dark mode.
// For actions with a meaning, use tone="success" (green, e.g. Done) or tone="danger" (red, e.g. Stop now).
// Use it like a normal <button>: <HoloButton onClick={...}>Start day</HoloButton>
export function HoloButton({ children, size = "md", tone = "theme", glowSize = 120, className = "", disabled, ...props }: Props) {
  const colors = tones[tone];
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 }); // mouse position inside the button
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = hovered && !disabled; // disabled buttons stay calm

  function trackMouse(event: React.MouseEvent<HTMLButtonElement>) {
    const box = buttonRef.current?.getBoundingClientRect();
    if (box) setMouse({ x: event.clientX - box.left, y: event.clientY - box.top });
  }

  return (
    <button
      {...props}
      ref={buttonRef}
      disabled={disabled}
      onMouseMove={trackMouse}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={`group relative flex items-center justify-center overflow-hidden border bg-surface/90 font-semibold tracking-wide shadow-sm select-none disabled:cursor-not-allowed disabled:opacity-40 ${
        colors.text
      } ${active ? colors.hoverBorder : colors.border} ${sizeClasses[size]} ${className}`}
      style={{
        // a soft colored halo around the button on hover
        boxShadow: active ? `0 0 20px color-mix(in srgb, ${colors.halo} 8%, transparent)` : undefined,
        // a tiny grow on hover and squish when pressed, with a bit of bounce
        transform: pressed && !disabled ? "scale(0.96)" : active ? "scale(1.02)" : "scale(1)",
        transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.3s, box-shadow 0.3s",
      }}
    >
      {/* 1. The glow that follows the mouse */}
      <span
        aria-hidden
        className="pointer-events-none absolute transition-opacity duration-500"
        style={{
          left: mouse.x - glowSize / 2,
          top: mouse.y - glowSize / 2,
          width: glowSize,
          height: glowSize,
          background: colors.flare,
          mixBlendMode: "var(--holo-blend)" as React.CSSProperties["mixBlendMode"],
          opacity: active ? 1 : 0,
        }}
      />

      {/* 2. The spinning gradient border. The mask cuts out the middle so only a 1.5px ring shows. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] transition-opacity duration-300"
        style={{
          margin: "-1px",
          padding: "1.5px",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          opacity: active ? 1 : disabled ? 0 : 0.25,
        }}
      >
        <span
          className="holo-beam absolute top-[-50%] left-[-50%] h-[200%] w-[200%]"
          style={
            {
              backgroundImage: colors.beam,
              "--beam-duration": active ? "2.5s" : "5s",
            } as React.CSSProperties
          }
        />
      </span>

      {/* 3. The shine that sweeps across on hover (half the original brightness) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-[30%] -skew-x-[25deg] bg-gradient-to-r from-transparent via-white/5 to-transparent"
        style={{ left: active ? "120%" : "-40%", transition: "left 1s ease-in-out" }}
      />

      {/* The button's text/icon, on top of the effects */}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
