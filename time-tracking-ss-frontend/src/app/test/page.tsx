"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import AuthForm from "@/components/AuthForm"

import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import type { User } from "@supabase/supabase-js"
import { Sun, Moon, Clock} from "lucide-react"

// 🔹 Tipo para las sesiones
interface WorkSession {
  id: number
  check_in: string
  check_out: string | null
  total_hours: number | null
  user_id: string
}

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
      {isLight ? <Moon size={18}/> : <Sun size={18}/>}
    </Button>
  )
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
    else{
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
    setElapsedTime(Math.floor((Date.now() - start) / 1000 ))
    timeRef.current = setInterval(() => {
      setElapsedTime((Math.floor((Date.now() - start) / 1000)))
    }, 1000)
  }

  // Detener el temporizador
  const stopTimer = () => {
    if(timeRef.current) clearInterval(timeRef.current)
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
    if(!user || !activeSession) return
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Work Sessions</h1>
          <p className="text-sm text-gray-500">Active User: {user?.email}</p>
        </div>

        <ThemeToggle />
      </div>

      {!user ? (
        <AuthForm />
      ) : (
        <>
        {/* 🔹 Control de sesion  */}
          <div className="space-y-4 p-4 border rounded flex flex-col items-start gap-2">
            {!activeSession ? (
              <button
              onClick={handleStart}
              className="bg-green-500 text-white px-5 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2"
            >
              <Clock size={18} /> Start Session
            </button>
            ) : (
              <>
                <div className="text-lg font-mono">⏱ {formatTime(elapsedTime)}</div>
                <button
                  onClick={handleEnd}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  End Session
                </button>
              </>
            )}
          </div>

          {/* 🔹 Listado de sesiones anteriores */}
          <div className="p-4 border rounded space-y-2">
            <div className="flex items-center gap-2"></div>
            <h2 className="text-lg font-bold">Previous Sessions</h2>
            {workSessions.length === 0 ? (
              <p>No sessions found.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="border px-2 py-1 text-left">User</th>
                    <th className="border px-2 py-1 text-left">Check-in → Check-out</th>
                    <th className="border px-2 py-1 text-left">Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {workSessions.map((s) => (
                    <tr
                      key={s.id}
                      className={s.check_out ? "" : "bg-yellow-100 dark:bg-yellow-800 font-semibold"}
                    >
                      <td className="border px-2 py-1">{user.email}</td>
                      <td className="border px-2 py-1">
                        {formatDateTime(s.check_in)} → {s.check_out ? formatDateTime(s.check_out) : "⏳ ongoing"}
                      </td>
                      <td className="border px-2 py-1">
                        {s.total_hours ? s.total_hours.toFixed(2) : "⏳ calculating"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 🔹 Logout */}
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              setUser(null)
              stopTimer()
              setWorkSessions([])
            }}
            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Logout
          </button>
        </>
      )}
    </div>
  )
}