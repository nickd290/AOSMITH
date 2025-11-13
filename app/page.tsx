import { redirect } from 'next/navigation'

// Server-side root page that immediately redirects to login
// This ensures Railway health checks get an instant response
export default function RootPage() {
  redirect('/login')
}
