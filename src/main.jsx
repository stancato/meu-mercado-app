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

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/service-worker.js').catch(() => {})

createRoot(document.getElementById('root')).render(<StrictMode><Root /></StrictMode>)
