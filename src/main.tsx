import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const saved = sessionStorage.getItem('spa-path'); if (saved) { sessionStorage.removeItem('spa-path'); history.replaceState(null, '', saved) }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
