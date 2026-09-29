import type { ReactNode } from "react";
import { useTheme, type ThemeChoice } from "../state/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./Icons";

const OPTIONS: { value: ThemeChoice; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "system", label: "Match system", icon: <MonitorIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
];

export default function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  return (
    <div role="radiogroup" aria-label="Colour theme" className="inline-flex rounded-md border border-zinc-800 bg-zinc-900/60 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={choice === o.value}
          title={o.label}
          aria-label={o.label}
          onClick={() => setChoice(o.value)}
          className={`flex h-6 w-7 items-center justify-center rounded transition ${
            choice === o.value ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
