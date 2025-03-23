import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { IPC_CHANNELS } from '@shared/constants'
import { Loader2, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useToast } from '../components/ui/use-toast'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'

interface McpmServer {
  id: string
  name: string
  installedDate: string
  status: 'enabled' | 'disabled'
  version: string
}

export default function HostsPage(): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState<McpmServer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [serverToDelete, setServerToDelete] = useState<McpmServer | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchServers()
  }, [])

  async function fetchServers() {
    try {
      console.log('🔍 Fetching installed servers...')
      setLoading(true)
      
      // Try both methods for fetching servers
      let data;
      try {
        // First try using window.api.mcpm.list()
        console.log('🔄 Attempting to use window.api.mcpm.list()')
        data = await window.api.mcpm.list()
      } catch (apiError) {
        console.warn('⚠️ Failed to use window.api.mcpm.list():', apiError)
        // Fallback to direct IPC invocation
        console.log('🔄 Falling back to direct IPC invocation')
        data = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.MCPM_LIST)
      }
      
      console.log('✅ Received servers:', data)
      setServers(data || [])
      setError(null)
    } catch (err) {
      console.error('❌ Error fetching servers:', err)
      setError('Failed to load servers. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (server: McpmServer, e: React.MouseEvent) => {
    e.stopPropagation()
    setServerToDelete(server)
  }

  const handleDeleteConfirm = async () => {
    if (!serverToDelete) return
    
    try {
      console.log(`🗑️ Deleting server: ${serverToDelete.id}`)
      setDeleting(true)
      
      try {
        // Try first with api method
        await window.api.mcpm.uninstall(serverToDelete.id)
      } catch (apiError) {
        console.warn('⚠️ Failed with api.mcpm.uninstall, trying alternative method:', apiError)
        // Fallback to direct IPC invocation
        await window.electron.ipcRenderer.invoke(IPC_CHANNELS.MCPM_REMOVE, serverToDelete.id)
      }
      
      console.log(`✅ Server deleted successfully: ${serverToDelete.id}`)
      toast({
        title: "Server deleted",
        description: `${serverToDelete.name} has been removed successfully.`,
      })
      
      // Update the server list
      await fetchServers()
    } catch (error) {
      console.error(`❌ Error deleting server:`, error)
      toast({
        title: "Error",
        description: `Failed to delete ${serverToDelete.name}.`,
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setServerToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    setServerToDelete(null)
  }

  return (
    <div className="mx-auto max-w-[800px] p-6">
      <Card>
        <CardHeader>
          <CardTitle>My Servers</CardTitle>
          <CardDescription>Manage your installed MCP servers</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading servers...</span>
            </div>
          ) : error ? (
            <div className="bg-destructive/20 p-4 rounded-md text-destructive">
              {error}
            </div>
          ) : servers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No servers installed yet.</p>
              <p className="mt-2">Visit the Discover tab to find and install servers.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {servers.map(server => (
                <Card key={server.id} className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{server.name}</h3>
                      <p className="text-sm text-muted-foreground">{server.id}</p>
                      <p className="text-xs mt-1">Version: {server.version}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        server.status === 'enabled' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}>
                        {server.status}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeleteClick(server, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <AlertDialog open={serverToDelete !== null} onOpenChange={(open) => !open && handleDeleteCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will uninstall <strong>{serverToDelete?.name}</strong> from your system.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              disabled={deleting} 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
