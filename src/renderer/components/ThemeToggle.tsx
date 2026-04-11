

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <button
      id="theme-toggle"
      onClick={onToggle}
      className="relative w-14 h-7 rounded-full transition-colors duration-300 cursor-pointer
                 bg-surface-200 dark:bg-surface-700 
                 hover:bg-surface-300 dark:hover:bg-surface-600
                 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 
                 dark:focus:ring-offset-surface-900"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md
                    flex items-center justify-center text-sm
                    transition-transform duration-300 ease-in-out
                    ${isDark ? 'translate-x-7' : 'translate-x-0'}`}
      >
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  );
}
