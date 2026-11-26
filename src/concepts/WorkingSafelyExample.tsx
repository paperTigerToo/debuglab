import { ChoiceQuiz, type QuizItem } from './ChoiceQuiz'

type Effect = 'reads' | 'changes' | 'destroys'

const items: QuizItem<Effect>[] = [
  {
    id: 'get-pods',
    prompt: 'kubectl get pods',
    code: true,
    answer: 'reads',
    why: 'It only asks the cluster what exists. Run it as often as you like.',
  },
  {
    id: 'save-logs',
    prompt: 'kubectl logs deployment/pantry-api > pantry-api.log',
    code: true,
    answer: 'reads',
    why: 'It reads the logs and writes a file on your own machine. Nothing in the cluster changes.',
    wrong: { changes: 'The file it writes is on your machine, not in the cluster.' },
  },
  {
    id: 'rollback',
    prompt: 'kubectl rollout undo deployment/pantry-api',
    code: true,
    answer: 'changes',
    why: 'It replaces every pod with the previous revision. It can be undone, but the old pods’ logs go with them.',
    wrong: { destroys: 'It can be rolled back again, so it is a change, not destruction, though the replaced pods’ logs are lost.' },
  },
  {
    id: 'explain-delete',
    prompt: 'kubectl exec postgres-0 -- psql -U pantry -c "EXPLAIN ANALYZE DELETE FROM carts WHERE updated_at < now() - interval \'30 days\'"',
    code: true,
    answer: 'destroys',
    why: 'EXPLAIN ANALYZE executes the statement to time it, so these rows are gone. Plain EXPLAIN, without ANALYZE, only plans it.',
    wrong: { reads: 'EXPLAIN alone only plans the statement, but EXPLAIN ANALYZE really runs it, and this one deletes rows.' },
  },
  {
    id: 'delete-wal',
    prompt: "kubectl exec postgres-0 -- sh -c 'rm /var/lib/postgresql/data/pg_wal/*'",
    code: true,
    answer: 'destroys',
    why: 'pg_wal holds changes not yet safely in the tables. Deleting it crashes PostgreSQL and loses data, as Full Disk shows.',
    wrong: { changes: 'Nothing brings these files back: PostgreSQL will not start without them.' },
  },
  {
    id: 'index',
    prompt: 'kubectl exec postgres-0 -- psql -U pantry -c "CREATE INDEX CONCURRENTLY orders_customer_id_idx ON orders (customer_id)"',
    code: true,
    answer: 'changes',
    why: 'It adds an index without blocking writes, and DROP INDEX CONCURRENTLY removes it again. A safe, reversible change.',
  },
]

export function WorkingSafelyExample() {
  return (
    <ChoiceQuiz
      title="What can it break?"
      instruction="Before you run a command in production, know what it does. Sort each one."
      options={[
        { id: 'reads', label: 'Only reads' },
        { id: 'changes', label: 'Changes the system' },
        { id: 'destroys', label: 'Destroys data' },
      ]}
      items={items}
      nudge="Think about what it changes in the cluster, and whether that could be undone."
    />
  )
}
