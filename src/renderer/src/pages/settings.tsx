import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { ClientSelector } from '../components/ClientSelector'

export default function SettingsPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-[800px] p-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Configure your application preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ClientSelector />
        </CardContent>
      </Card>
    </div>
  )
}
