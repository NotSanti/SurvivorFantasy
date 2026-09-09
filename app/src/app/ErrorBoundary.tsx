import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Kindling render error', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto flex min-h-svh max-w-lg items-center px-4">
          <ErrorState
            title="Kindling hit a snag"
            description={this.state.error.message}
            onRetry={() => this.setState({ error: null })}
          />
        </main>
      )
    }

    return this.props.children
  }
}
