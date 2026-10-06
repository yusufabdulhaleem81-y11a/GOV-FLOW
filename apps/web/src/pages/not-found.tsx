import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <p className="text-5xl font-bold text-muted-foreground/30">404</p>
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The page you're looking for doesn't exist or was moved.</p>
      <Link to="/dashboard" className="mt-2 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90">
        Back to dashboard
      </Link>
    </div>
  )
}
