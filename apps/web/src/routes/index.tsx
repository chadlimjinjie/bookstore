import { createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { errorMessage, request } from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Open Library subject names; each checked to return 2026 English books.
const SUBJECTS = ['romance', 'fantasy', 'science fiction', 'mystery', 'thriller', 'young adult', 'biography', 'history', 'self-help', 'business', 'poetry', 'comics']

type Search = { subject?: string[]; match?: 'any' }

export const Route = createFileRoute('/')({
  component: Latest,
  // Unknown values from the URL are dropped; no valid subject means "All".
  validateSearch: (s: Record<string, unknown>): Search => {
    const subject = SUBJECTS.filter((x) => [s.subject].flat().includes(x))
    return { subject: subject.length ? subject : undefined, match: s.match === 'any' ? 'any' : undefined }
  },
})

type Doc = { key: string; title: string; author_name?: string[]; cover_i?: number; subject?: string[] }

const LIMIT = 24

// ponytail: Open Library only has year-level dates and noisy metadata. Switch to
// Google Books or our own API if "published today" precision is needed.
// all: every clause must match (Open Library ANDs clauses). any: one OR group.
const subjectQuery = ({ subject = [], match }: Search) => {
  const terms = subject.map((x) => `subject:"${x}"`)
  return !terms.length ? '' : match === 'any' ? ` (${terms.join(' OR ')})` : ` ${terms.join(' ')}`
}

const fetchLatest = (year: number, search: Search, page: number, signal: AbortSignal) =>
  request<{ numFound: number; docs: Doc[] }>({
    url: 'https://openlibrary.org/search.json',
    params: {
      q: `first_publish_year:${year} language:eng` + subjectQuery(search),
      sort: 'new',
      limit: LIMIT,
      page,
      fields: 'key,title,author_name,cover_i,subject',
    },
    signal,
  })

// Matches Tailwind's sm (640px) / lg (1024px) breakpoints.
const getColumns = () => (innerWidth >= 1024 ? 3 : innerWidth >= 640 ? 2 : 1)
const onResize = (cb: () => void) => {
  addEventListener('resize', cb)
  return () => removeEventListener('resize', cb)
}

function Latest() {
  const year = new Date().getFullYear()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const selected = search.subject ?? []
  const toggle = (x: string) => {
    const subject = selected.includes(x) ? selected.filter((y) => y !== x) : [...selected, x]
    navigate({ search: { ...search, subject: subject.length ? subject : undefined } })
  }
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } =
    useInfiniteQuery({
      queryKey: ['latest', year, search],
      queryFn: ({ pageParam, signal }) => fetchLatest(year, search, pageParam, signal),
      initialPageParam: 1,
      getNextPageParam: (last, _all, page) => (page * LIMIT < last.numFound ? page + 1 : undefined),
      staleTime: 60 * 60 * 1000,
    })
  const books = data?.pages.flatMap((p) => p.docs) ?? []

  // Virtualize by row: only rows near the viewport are in the DOM.
  const cols = useSyncExternalStore(onResize, getColumns)
  const list = useRef<HTMLDivElement>(null)
  const rows = useWindowVirtualizer({
    count: Math.ceil(books.length / cols),
    estimateSize: () => 340,
    overscan: 3,
    scrollMargin: list.current?.offsetTop ?? 0,
  })

  // Load the next page when the button at the bottom scrolls into view.
  const sentinel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && fetchNextPage(), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="font-heading text-2xl font-semibold">Latest books ({year})</h1>
      <div role="group" aria-label="Categories" className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={selected.length ? 'outline' : 'default'}
          aria-pressed={!selected.length}
          onClick={() => navigate({ search: {} })}
        >
          All
        </Button>
        {SUBJECTS.map((x) => (
          <Button
            key={x}
            size="sm"
            variant={selected.includes(x) ? 'default' : 'outline'}
            aria-pressed={selected.includes(x)}
            onClick={() => toggle(x)}
          >
            {label(x)}
          </Button>
        ))}
      </div>
      {selected.length > 1 && (
        <div role="group" aria-label="Match" className="flex gap-2">
          {(['all', 'any'] as const).map((m) => {
            const on = (search.match ?? 'all') === m
            return (
              <Button
                key={m}
                size="xs"
                variant={on ? 'secondary' : 'ghost'}
                aria-pressed={on}
                onClick={() => navigate({ search: { ...search, match: m === 'any' ? 'any' : undefined } })}
              >
                Match {m}
              </Button>
            )
          })}
        </div>
      )}
      {isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !data ? (
        <p role="alert" className="text-destructive">{errorMessage(error)}</p>
      ) : books.length === 0 ? (
        <p className="text-muted-foreground">No new books found.</p>
      ) : (
        <div ref={list} className="relative" style={{ height: rows.getTotalSize() }}>
          {rows.getVirtualItems().map((row) => (
            <div
              key={row.key}
              data-index={row.index}
              ref={rows.measureElement}
              className="absolute inset-x-0 top-0 grid gap-4 pb-4"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                transform: `translateY(${row.start - rows.options.scrollMargin}px)`,
              }}
            >
              {books.slice(row.index * cols, (row.index + 1) * cols).map((b) => (
                <BookCard key={b.key} book={b} />
              ))}
            </div>
          ))}
        </div>
      )}
      {hasNextPage && (
        // Doubles as a keyboard/manual fallback and a retry after a failed page.
        <button
          ref={sentinel}
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mx-auto block text-muted-foreground hover:underline"
        >
          {isFetchingNextPage ? 'Loading…' : isFetchNextPageError ? 'Failed to load. Retry' : 'Load more'}
        </button>
      )}
    </main>
  )
}

const label = (x: string) => x[0].toUpperCase() + x.slice(1)

function BookCard({ book: b }: { book: Doc }) {
  // Substring match mirrors Open Library's: "fantasy" matches "Fiction, fantasy, general".
  const tags = SUBJECTS.filter((s) => b.subject?.some((x) => x.toLowerCase().includes(s)))
  return (
    <Card>
      {b.cover_i && (
        <img
          src={`https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`}
          alt={`Cover of ${b.title}`}
          loading="lazy"
          className="mx-auto h-48 object-contain"
        />
      )}
      <CardHeader>
        <CardTitle>
          <a href={`https://openlibrary.org${b.key}`} target="_blank" rel="noopener" className="hover:underline">
            {b.title}
          </a>
        </CardTitle>
        <CardDescription>{b.author_name?.join(', ') ?? 'Unknown author'}</CardDescription>
        {tags.length > 0 && (
          <ul aria-label="Categories" className="flex flex-wrap gap-1 pt-1">
            {tags.map((t) => (
              <li key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {label(t)}
              </li>
            ))}
          </ul>
        )}
      </CardHeader>
    </Card>
  )
}
