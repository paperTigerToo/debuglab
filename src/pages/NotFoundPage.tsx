import { Link } from 'react-router'
import { PageHeading } from './Placeholder'

export function NotFoundPage() {
  return (
    <PageHeading title="Page not found">
      Nothing lives at this address. <Link className="text-accent underline" to="/">Go to the home page.</Link>
    </PageHeading>
  )
}
