"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function SessionForm() {
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase
      .from("work_sessions") // 👈 nombre de tu tabla
      .insert([{ check_in: checkIn, check_out: checkOut }])

    if (error) {
      setMessage(`❌ Error: ${error.message}`)
    } else {
      setMessage("✅ Session saved successfully!")
      setCheckIn("")
      setCheckOut("")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded">
      <div>
        <label className="block mb-1">Start Time</label>
        <input
          type="datetime-local"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="border px-2 py-1 w-full"
          required
        />
      </div>
      <div>
        <label className="block mb-1">End Time</label>
        <input
          type="datetime-local"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="border px-2 py-1 w-full"
          required
        />
      </div>
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Save Session
      </button>
      {message && <p className="mt-2">{message}</p>}
    </form>
  )
}
