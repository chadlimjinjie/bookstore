import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

const client = axios.create({ baseURL: import.meta.env.VITE_API_URL })

/** Orval mutator: every generated call goes through here. */
export const request = <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> =>
  client({ ...config, ...options }).then((res) => {
    // A wrong/missing VITE_API_URL hits the SPA fallback, which answers 200 with index.html.
    if (String(res.headers['content-type']).includes('text/html'))
      throw new Error(`Expected JSON from ${res.config.url}, got HTML. Check VITE_API_URL.`)
    return res.data
  })

export type ErrorType<E> = AxiosError<E>

/** The server's `{ error }` message, or a generic one (network failure). */
export const errorMessage = (e: unknown) =>
  (axios.isAxiosError(e) && e.response?.data?.error) || 'Something went wrong. Please try again.'
