import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import useCurrentUser from "../utils/useCurrentUser";
import StatusAlert from "../components/Shared/StatusAlert";


const Login = () => {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  
  const { data: currentUser, isLoading } = useCurrentUser();
  
  const signinMutation = useMutation({
    mutationKey: ['currentUser'],
    mutationFn: async () => {
        const res = await fetch(`${import.meta.env.VITE_API_URL + '/user/login'}` , {
            method: 'POST',
            credentials: 'include',
            headers: {
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({email, password})
        })

        const data = await res.json()

        if(!res.ok) {
            throw new Error(data.message || 'Request Failed')
        }

        return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })

      const user = data?.user
      if(user?.must_change_password){
        navigate('/change-password', { replace: true })
        return
      }

      navigate(`/${user.role}`, { replace: true })
    }
  })

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <StatusAlert type="loading" message="Checking your session..." />
      </main>
    );
  }

  if(currentUser?.user?.must_change_password) {
    return <Navigate to="/change-password" replace />
  }

  if(currentUser?.user) {
    return <Navigate to={`/${currentUser.user.role}`} replace />
  }


  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col">
        <header className="flex w-full items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
              <span className="font-bold text-white">DC</span>
            </div>

            <div className="leading-tight">
              <p className="font-semibold text-slate-900">D&amp;C Prime</p>
              <p className="text-sm text-slate-500">Internal System</p>
            </div>
          </div>

          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-600 hover:text-blue-600"
          >
            Contact Support
          </button>
        </header>

        <section className="flex flex-1 items-center justify-center py-8">
          <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 lg:grid-cols-2">
            <div className="relative flex min-h-[260px] flex-col justify-between bg-slate-950 p-6 text-white sm:p-8 lg:min-h-[520px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.35),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.2),_transparent_30%)]" />

              <div className="relative z-10">
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
                  <span className="font-bold text-white">DC</span>
                </div>

                <div className="max-w-md space-y-4">
                  <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                    D&amp;C Prime Realty internal system
                  </h1>

                  <p className="text-sm leading-6 text-slate-300 sm:text-base">
                    Manage projects, listings, clients, collections, payroll,
                    and operational reports from one secure workspace.
                  </p>
                </div>
              </div>

              <div className="relative z-10 mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                Secure access for approved users only.
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault()
              signinMutation.mutate()
            }} className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
              <div className="mb-8 space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  Welcome back
                </p>

                <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">
                  Sign in
                </h2>

                <p className="text-sm leading-6 text-slate-500">
                  Use your D&amp;C Prime account credentials to continue.
                </p>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Email
                  </span>

                  <input
                    type="email"
                    placeholder="admin@gmail.com"
                    onChange={(e) => {setEmail(e.currentTarget.value)}}
                    value={email}
                    autoComplete="email"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </span>

                  <input
                    type="password"
                    placeholder="Enter your password"
                    onChange={(e) => {setPassword(e.currentTarget.value)}}
                    value={password}
                    autoComplete="current-password"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Remember me
                  </label>

                  <button
                    type="button"
                    className="text-left text-sm font-medium text-blue-700 hover:text-blue-800 sm:text-right"
                  >
                    Forgot password?
                  </button>
                </div>

                {signinMutation.isPending ? <StatusAlert type="loading" message="Signing in..." /> : null}
                {signinMutation.isError ? <StatusAlert type="error" message={signinMutation.error.message} /> : null}

                <button
                  type="submit"
                  disabled={signinMutation.isPending}
                  className="h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold tracking-wide text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {
                    signinMutation.isPending ? 'Signing in' : 'Sign in'
                  }
                </button>
              </div>

              <p className="mt-8 text-center text-xs leading-5 text-slate-500">
                Having trouble signing in? Contact your system administrator.
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;

