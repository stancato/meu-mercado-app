import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { onAuthStateChanged } from 'firebase/auth'
import App from './App'
import { auth } from './firebase'
import { StoreProvider } from './store'
import './styles.css'

function Root() {
  const [user, setUser] = useState(null)
  useEffect(() => auth ? onAuthStateChanged(auth, setUser) : undefined, [])
  return <StoreProvider user={user}><App user={user} /></StoreProvider>
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let hasController = Boolean(navigator.serviceWorker.controller)
  let refreshing = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasController) {
      hasController = true
      return
    }
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
    .then((registration) => {
      const checkForUpdate = () => registration.update().catch(() => {})

      checkForUpdate()
      window.addEventListener('online', checkForUpdate)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.setInterval(checkForUpdate, 60 * 60 * 1000)
    })
    .catch(() => {})
}

createRoot(document.getElementById('root')).render(<StrictMode><Root /></StrictMode>)
