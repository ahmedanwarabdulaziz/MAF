import { redirect } from 'next/navigation'

// This page is deprecated — certificate creation is now handled via modal on the list page.
export default function NewCertificatePageDeprecated({ params }: { params: { id: string } }) {
  redirect(`/projects/${params.id}/certificates`)
}
