import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/providers/theme-provider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const Icon = theme === 'dark' ? Sun : Moon

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  )
}
