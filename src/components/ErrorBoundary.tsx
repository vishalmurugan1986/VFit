import { TriangleExclamationPoint } from 'lucide-react'
import { Component, type ReactNode } from 'react'
import { Button } from './ui'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const storage = /indexeddb|database|storage|quota/i.test(`${error.name} ${error.message}`)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <TriangleExclamationPoint className="size-8 text-bad-ink" aria-hidden />
        <h1 className="text-title2 font-semibold">Something went wrong</h1>
        <p className="text-footnote text-ink-2">
          {storage
            ? "The app couldn't open its storage. Private browsing or blocked site data can cause this."
            : 'Your data is safe. Reloading usually fixes this.'}
        </p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <pre className="mt-2 max-w-full overflow-auto rounded-xl bg-fill p-3 text-left text-footnote text-ink-2">
          {error.message}
        </pre>
      </div>
    )
  }
}
