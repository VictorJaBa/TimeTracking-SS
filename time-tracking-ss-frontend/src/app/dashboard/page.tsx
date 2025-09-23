"use client"
import { useEffect, useState, useRef } from "react"
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
        {isLight ? <Moon size={18}/> : <Sun size={18}/>}
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

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user ?? null)
    }
    getSession()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) fetchWorkSessions()
      }
    )

    return () => subscription.subscription.unsubscribe()
  }, [])

  const fetchWorkSessions = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from("work_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("check_in", { ascending: false })
    if (error) console.error(error)
    else {
      setWorkSessions(data || [])
      const ongoing = data?.find((s) => !s.check_out)
      if (ongoing) startTimer(ongoing)
    }
  }

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Work Dashboard</h1>
        <ThemeToggle />
      </div>

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

          {/* Tarjetas de sesiones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workSessions.map((s) => {
              const isActive = !s.check_out
              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-lg border shadow-md ${
                    isActive
                      ? "bg-yellow-100 dark:bg-yellow-800 border-yellow-400"
                      : "bg-green-100 dark:bg-green-800 border-green-400"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">{user.email}</h3>
                    {isActive ? <Clock size={20} /> : <Check size={20} />}
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">Check-in:</span>{" "}
                    {formatDateTime(s.check_in)}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Check-out:</span>{" "}
                    {s.check_out ? formatDateTime(s.check_out) : "⏳ ongoing"}
                  </p>
                  <p className="mt-2 font-mono">
                    Total Hours: {s.total_hours ? s.total_hours.toFixed(2) : "⏳ calculating"}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Logout */}
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              setUser(null)
              stopTimer()
              setWorkSessions([])
            }}
            className="mt-6 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            Logout
          </button>
        </>
      )}
    </div>
  )
}
