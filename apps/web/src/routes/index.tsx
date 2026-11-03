import { createFileRoute } from '@tanstack/react-router'
import { useListBooks } from '@/api/gen'
import { errorMessage } from '@/api/axios'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({ component: Books })

function Books() {
  const { data: books, isPending, error } = useListBooks()

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="font-heading text-2xl font-semibold">Bookstore</h1>
      {isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : error ? (
        <p role="alert" className="text-destructive">{errorMessage(error)}</p>
      ) : books.length === 0 ? (
        <p className="text-muted-foreground">No books yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {books.map((b) => (
            <Card key={b.id}>
              <CardHeader>
                <CardTitle>{b.title}</CardTitle>
                <CardDescription>
                  {b.author} · ${b.price.toFixed(2)}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
