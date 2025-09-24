"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/ThemeToggle"

export default function AuthForm(){
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [message, setMessage] = useState("")

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        const { error } = await supabase.auth.signUp({ email, password })
        if(error) setMessage(`❌ Sign up error: ${error.message}`)
        else setMessage("✅ Check your email to confirm sign up!")
    }

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if(error) setMessage(`❌ Sign in error: ${error.message}`)
        else setMessage("✅ Sign in successfully!")
    }

    const handleSignOut = async () => {
        const { error } = await supabase.auth.signOut()
        if(error) setMessage(`❌ Sign out error: ${error.message}`)
        else setMessage("👋 See you later!")
    }

    return (
        <div className="p-6 max-w-sm mx-auto space-y-4">
          <h2 className="text-xl font-bold">Authentication</h2>
          <form onSubmit={handleSignIn} className="space-y-3 p-4 border rounded">
            <div>
              <label className="block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border px-2 py-1 w-full"
                required
              />
            </div>
            <div>
              <label className="block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border px-2 py-1 w-full"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
                Sign In
              </button>
              <button type="button" onClick={handleSignUp} className="bg-gray-200 px-4 py-2 rounded text-gray-800">
                Sign Up
              </button>
              <button type="button" onClick={handleSignOut} className="bg-red-600 text-white px-4 py-2 rounded">
                Sign Out
              </button>
            </div>
            {message && <p className="mt-2">{message}</p>}
          </form>
        </div>
      )
}