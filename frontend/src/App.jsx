import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Map, Navigation, Activity } from 'lucide-react'
import RealTimePage from './pages/RealTimePage'
import HistoricalPage from './pages/HistoricalPage'
import Header from './components/Layout/Header'
import Sidebar from './components/Layout/Sidebar'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
        <Header />
        
        <div className="flex">
          <Sidebar />
          
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<RealTimePage />} />
              <Route path="/historico" element={<HistoricalPage />} />
            </Routes>
          </main>
        </div>
        
        <footer className="mt-8 p-4 text-center text-primary-600 text-sm border-t border-primary-200">
          <p>Sistema de Monitoreo Acústico en Tiempo Real • {new Date().getFullYear()}</p>
        </footer>
      </div>
    </Router>
  )
}

export default App