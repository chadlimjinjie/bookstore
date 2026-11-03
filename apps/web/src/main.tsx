import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import './index.css'
import { routeTree } from './routeTree.gen'

// Plain query strings (?subject=a&subject=b) instead of the default JSON encoding.
// ponytail: flat values only (string or string[]); nested objects would need the default serializer.
const router = createRouter({
  routeTree,
  parseSearch: (str) => {
    const params = new URLSearchParams(str)
    return Object.fromEntries(
      [...new Set(params.keys())].map((k) => {
        const all = params.getAll(k)
        return [k, all.length > 1 ? all : all[0]]
      }),
    )
  },
  stringifySearch: (search) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(search))
      for (const x of [v].flat()) if (x !== undefined) params.append(k, String(x))
    const str = params.toString()
    return str ? `?${str}` : ''
  },
})
// Auth API failures are 4xx answers, which a retry cannot change.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
