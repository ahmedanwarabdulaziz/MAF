import { redirect } from 'next/navigation'

export default function Home() {
  // Redirection to the main corporate systems portal.
  // The middleware will automatically intercept this and redirect to /login if the user is not authenticated.
  redirect('/company')
}
