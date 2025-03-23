import { useEffect, useState } from 'react'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { VALID_CLIENTS, ClientType } from '@shared/constants'
import { Label } from '@/components/ui/label'

export interface ClientSelectorProps {
  defaultValue?: ClientType
  onClientChange?: (client: ClientType) => void
}

export const ClientSelector: React.FC<ClientSelectorProps> = ({ 
  defaultValue = 'cursor',
  onClientChange
}) => {
  const [settings, setSettings] = useState<{ client: ClientType }>({ client: defaultValue })
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true)
        const savedSettings = await window.api.settings.get() as { client: ClientType }
        setSettings(savedSettings)
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleClientChange = async (value: string) => {
    try {
      const clientValue = value as ClientType
      const updatedSettings = { ...settings, client: clientValue }
      await window.api.settings.set(updatedSettings)
      setSettings(updatedSettings)
      
      if (onClientChange) {
        onClientChange(clientValue)
      }
    } catch (error) {
      console.error('Failed to update client setting:', error)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="client-select">Smithery Client</Label>
      <Select 
        disabled={loading}
        value={settings.client} 
        onValueChange={handleClientChange}
      >
        <SelectTrigger id="client-select" className="w-full">
          <SelectValue placeholder="Select a client" />
        </SelectTrigger>
        <SelectContent>
          {VALID_CLIENTS.map((client) => (
            <SelectItem key={client} value={client}>
              {client.charAt(0).toUpperCase() + client.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        Select the client to use with Smithery CLI for installation and uninstallation.
      </p>
    </div>
  )
} 