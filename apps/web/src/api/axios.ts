import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

const client = axios.create({ baseURL: import.meta.env.VITE_API_URL })

/** Orval mutator: every generated call goes through here. */
export const request = <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> =>
  client({ ...config, ...options }).then((res) => res.data)

export type ErrorType<E> = AxiosError<E>

/** The server's `{ error }` message, or a generic one (network failure). */
export const errorMessage = (e: unknown) =>
  (axios.isAxiosError(e) && e.response?.data?.error) || 'Something went wrong. Please try again.'
