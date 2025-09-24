"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import AuthForm from "@/components/AuthForm"

import type { User } from "@supabase/supabase-js"
import { Clock, Trash2, Edit2 } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"

// 🔹 Tipo para las sesiones
interface WorkSession {
  id: number
  check_in: string
  check_out: string | null
  total_hours: number | null
  user_id: string
}

export default function TestPage() {
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([])
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null)
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const timeRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [message, setMessage] = useState("")
  const [user, setUser] = useState<User | null>(null) // 👈 Guarda el usuario actual

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

  // 🔹 Guardar nueva sesión
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (new Date(endTime) <= new Date(startTime)) {
      setMessage("⚠️ End time must be later than start time.")
      return
    }

    // Obtenemos el usuario actual desde Supabase
    const currentUser = (await supabase.auth.getUser()).data.user

    if (!currentUser) {
      setMessage("⚠️ You must be logged in to save a work session.")
      return
    }

    //Calculamos total_hours
    const totalHours =
      (new Date(endTime).getTime() - new Date(startTime).getTime()) /
      (1000 * 60 * 60)

    //Insert en Supabase
    const { error } = await supabase
      .from("work_sessions")
      .insert([{ check_in: startTime, check_out: endTime, user_id: currentUser.id, total_hours: totalHours }])

    if (error) {
      setMessage(`❌ Error: ${error.message}`)
    } else {
      setMessage("✅ Work session saved successfully!")
      setStartTime("")
      setEndTime("")
      fetchWorkSessions()
    }
  }

  // Iniciar temporizador
  const startTimer = (session: WorkSession) => {
    setActiveSession(session)
    const start = new Date(session.check_in).getTime()
    setElapsedTime(Math.floor((Date.now() - start) / 1000))
    timeRef.current = setInterval(() => {
      setElapsedTime((Math.floor((Date.now() - start) / 1000)))
    }, 1000)
  }

  // Detener el temporizador
  const stopTimer = () => {
    if (timeRef.current) clearInterval(timeRef.current)
    timeRef.current = null
    setActiveSession(null)
    setElapsedTime(0)
    fetchWorkSessions()
  }

  // Start Session
  const handleStart = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from("work_sessions")
      .insert([{ check_in: new Date().toISOString(), user_id: user.id }])
      .select()
    if (error) console.error("Error starting session:", error)
    else if (data && data[0]) startTimer(data[0])
  }

  // End Session
  const handleEnd = async () => {
    if (!user || !activeSession) return
    const checkOut = new Date().toISOString()
    const totalHours = (new Date(checkOut).getTime() - new Date(activeSession.check_in).getTime()) / (1000 * 60 * 60)
    const { error } = await supabase
      .from("work_sessions")
      .update({ check_out: checkOut, total_hours: totalHours })
      .eq("id", activeSession.id)
    if (error) console.error("Error ending session:", error)
    stopTimer()
    fetchWorkSessions()
  }

  // Formatear tiempo en HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0")
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${h}:${m}:${s}`
  }

  // Formater fecha en zona local
  const formatDateTime = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  const handleUpdate = async (id: string, newCheckIn: string, newCheckOut: string) => {
    const totalHours = (new Date(newCheckOut).getTime() - new Date(newCheckIn).getTime() / (1000 * 60 * 60))
    const { error } = await supabase
      .from("work_sessions")
      .update({ check_in: newCheckIn, check_out: newCheckOut, total_hours: totalHours })
      .eq("id", id)
    if (error) console.error("Error updating session:", error)
    else fetchWorkSessions()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return
    const { error } = await supabase
      .from("work_sessions")
      .delete()
      .eq("id", id)
    if (error) console.error("Error deleting session:", error)
    else fetchWorkSessions()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-bold">Work Dashboard</h1>
          <p className="text-sm text-gray-500">Active User: {user?.email}</p>
        </div>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      {!user ? (
        <AuthForm />
      ) : (
        <>
          {/* Botones Start / End */}
          <div className="flex items-center gap-4 mb-4">
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

          {/* Lista de sesiones con CRUD */}
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Acciones
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
                        <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                          <button
                            onClick={() => handleDelete(session.id.toString())}
                            className="text-red-500 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 size={16} /> Delete
                          </button>
                          {!isActive && (
                            <button
                              onClick={() => {
                                const newCheckIn = prompt("Nueva hora de check-in:", session.check_in)
                                const newCheckOut = prompt("Nueva hora de check-out:", session.check_out || '')
                                if (newCheckIn && newCheckOut) handleUpdate(session.id.toString(), newCheckIn, newCheckOut)
                              }}
                              className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
                            >
                              <Edit2 size={16} /> Edit
                            </button>
                          )}
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