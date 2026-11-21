import '@fontsource-variable/inter'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { isStandalone } from './lib/device'
import './index.css'

// Installed apps ask the browser to keep their storage (it can otherwise be evicted
// under storage pressure). Browsers grant this silently for installed apps.
if (isStandalone()) {
  void navigator.storage?.persisted?.().then((persisted) => {
    if (!persisted) void navigator.storage.persist?.()
  })
}

// Development only: ?demo fills this browser with six weeks of sample data (see src/dev/demo.ts).
if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
  const demo = new URLSearchParams(location.search).get('demo')
  await (await import('./dev/demo')).seedDemo({ workout: demo === 'workout', light: demo === 'light' })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
