"use client"
import { useEffect, useState, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import AuthForm from "@/components/AuthForm"
import { Clock, Check } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Sun, Moon } from "lucide-react"
import { User } from "@supabase/supabase-js"

// 🔹 Theme toggle component (named export)
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const isLight = theme === "light"

  return (
    <Button
      variant="outline"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="flex items-center gap-2"
    >
      {isLight ? <Moon size={18} /> : <Sun size={18} />}
    </Button>
  )
}

interface WorkSession {
  id: number
  check_in: string
  check_out: string | null
  total_hours: number | null
  user_id: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null) // 👈 Guarda el usuario actual
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([])
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null)
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const timeRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 🔹 Fetch work_sessions
  const fetchWorkSessions = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from("work_sessions")
      .select("*")
      .eq("user_id", user.id) // 👈 traer solo del usuario logueado
      .order("check_in", { ascending: true })
    // .limit(5) // 👈 limitar testing a 5
    if (error) console.error("Error fetching work_sessions:", error)
    else {
      setWorkSessions((data || []) as WorkSession[])
      // 👉 Si hay sesiones sin check_out, la tomamos como activa
      const ongoing = data?.find(s => !s.check_out)
      if (ongoing) setActiveSession(ongoing)
    }
  }, [user])

  // 🔹 Revisar sesión al montar y escuchar cambios
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user ?? null)
      if (data.user) {
        fetchWorkSessions() // 👉 Disparar Fetch al montar 
      }
    }
    getSession()

    // 👀 Listener: detecta login/logout en tiempo real
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) fetchWorkSessions()
      }
    )

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [fetchWorkSessions])

  const startTimer = (session: WorkSession) => {
    setActiveSession(session)
    const start = new Date(session.check_in).getTime()
    setElapsedTime(Math.floor((Date.now() - start) / 1000))
    timeRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - start) / 1000))
    }, 1000)
  }

  const stopTimer = () => {
    if (timeRef.current) clearInterval(timeRef.current)
    timeRef.current = null
    setActiveSession(null)
    setElapsedTime(0)
  }

  const handleStart = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from("work_sessions")
      .insert([{ check_in: new Date().toISOString(), user_id: user.id }])
      .select()
    if (error) console.error(error)
    else if (data && data[0]) startTimer(data[0])
  }

  const handleEnd = async () => {
    if (!user || !activeSession) return
    const checkOut = new Date().toISOString()
    const totalHours =
      (new Date(checkOut).getTime() - new Date(activeSession.check_in).getTime()) /
      (1000 * 60 * 60)
    const { error } = await supabase
      .from("work_sessions")
      .update({ check_out: checkOut, total_hours: totalHours })
      .eq("id", activeSession.id)
    if (error) console.error(error)
    stopTimer()
    fetchWorkSessions()
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0")
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${h}:${m}:${s}`
  }

  const formatDateTime = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header/Navbar */}
      <header className="flex justify-between items-center p-4 border-b">
        <h1 className="text-2xl font-bold">Work Dashboard</h1>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {!user ? (
        <AuthForm />
      ) : (
        <>
          {/* Control de sesión */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            {!activeSession ? (
              <button
                onClick={handleStart}
                className="bg-green-500 text-white px-5 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2"
              >
                <Clock size={18} /> Start Session
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-lg font-mono flex items-center gap-1">
                  <Clock /> {formatTime(elapsedTime)}
                </div>
                <button
                  onClick={handleEnd}
                  className="bg-red-500 text-white px-5 py-2 rounded-lg hover:bg-red-600 flex items-center gap-2"
                >
                  End Session
                </button>
              </div>
            )}
          </div>

          {/* Sección de resumen */}
          <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Resumen de Horas</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300">Horas Totales</p>
                <p className="text-2xl font-bold">
                  {workSessions.reduce((total, s) => total + (s.total_hours || 0), 0).toFixed(2)} horas
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-300">Sesiones Registradas</p>
                <p className="text-2xl font-bold text-right">{workSessions.length}</p>
              </div>
            </div>
          </div>

          {/* Lista de sesiones */}
          <div className="border rounded-lg overflow-hidden">
            <h2 className="text-xl font-bold p-4 bg-gray-50 dark:bg-gray-800 border-b">Historial de Sesiones</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Check-in
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Check-out
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Duración
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {workSessions.map((session) => {
                    const isActive = !session.check_out;
                    return (
                      <tr key={session.id} className={isActive ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}>                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isActive ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-800/50 dark:text-yellow-200">
                              En curso
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                              Completada
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatDateTime(session.check_in)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {session.check_out ? formatDateTime(session.check_out) : 'En progreso'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                          {session.total_hours ? `${session.total_hours.toFixed(2)}h` : 'Calculando...'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {workSessions.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No hay sesiones registradas
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
