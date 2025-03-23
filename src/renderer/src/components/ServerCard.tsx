/* eslint-disable @typescript-eslint/no-unused-vars */
import { Tag } from '@/components/Tag'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Check, Download, Loader2, Trash } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSecureImage } from '@/hooks/useSecureImage'
import { RegistryMCPServerItem } from '@shared/types'
import { IPC_CHANNELS } from '@shared/constants'
import { toast } from '@/components/ui/use-toast'

export type InstallStatus = 'install' | 'installing' | 'installed'

export interface MCPServerCardData {
  registryInfo: RegistryMCPServerItem;
  isInstalled: boolean;
}

export const ServerCard: React.FC<MCPServerCardData> = ({
  registryInfo, 
  isInstalled,
}) => {
  const {
    id,
    title,
    description,
    tags,
    creator,
    logoUrl,
  } = registryInfo

  const navigate = useNavigate()
  const [installStatus, setInstallStatus] = useState<InstallStatus>(
    isInstalled ? 'installed' : 'install'
  )
  const [buttonHovered, setButtonHovered] = useState(false)
  const onError = useCallback((error: Error) => {
    console.error('Failed to load server logo:', error)
  }, [])
  const { imageSrc } = useSecureImage(logoUrl!, {
    onError
  })

  const handleCardClick = () => {
    navigate(`/discover/${id}`)
  }

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Prevent action if already installing
    if (installStatus === 'installing') return
    
    // If already installed, handle uninstall
    if (installStatus === 'installed') {
      try {
        console.log(`🗑️ Uninstalling server: ${id}`)
        setInstallStatus('installing') // Show loading state for uninstall
        
        // Try first method (using api object)
        try {
          await window.api.mcpm.uninstall(id)
        } catch (apiError) {
          console.warn('⚠️ Failed with api.mcpm.uninstall, trying alternative method:', apiError)
          // Fallback to direct IPC invocation
          await window.electron.ipcRenderer.invoke(IPC_CHANNELS.MCPM_REMOVE, id)
        }
        
        console.log(`✅ Successfully uninstalled server: ${id}`)
        setInstallStatus('install')
        toast({
          title: "Uninstallation successful",
          description: `${title} has been uninstalled successfully.`,
        })
      } catch (error) {
        console.error(`❌ Failed to uninstall server: ${id}`, error)
        setInstallStatus('installed') // Reset to installed state
        toast({
          title: "Uninstallation failed",
          description: `Failed to uninstall ${title}. Please try again.`,
          variant: "destructive"
        })
      }
      return
    }
    
    // Set UI to installing state
    setInstallStatus('installing')
    
    try {
      console.log(`🚀 Installing server: ${id}`)
      
      // Set a timeout to prevent infinite loading state
      const timeoutId = setTimeout(() => {
        // Direkte Prüfung des aktuellen Status-Werts
        const currentStatus = document.getElementById(`install-status-${id}`)?.dataset.status;
        if (currentStatus === 'installing') {
          console.error(`⏱️ Installation timeout for: ${id}`)
          setInstallStatus('install')
          toast({
            title: "Installation timeout",
            description: `The installation is taking too long. Please try again or check the logs.`,
            variant: "destructive"
          })
        }
      }, 120000) // 2 minutes timeout
      
      // Try first method (using api object)
      try {
        await window.api.mcpm.install(id)
      } catch (apiError) {
        console.warn('⚠️ Failed with api.mcpm.install, trying alternative method:', apiError)
        // Fallback to direct IPC invocation
        await window.electron.ipcRenderer.invoke(IPC_CHANNELS.MCPM_INSTALL, id)
      }
      
      // Clear timeout on successful installation
      clearTimeout(timeoutId)
      
      console.log(`✅ Successfully installed server: ${id}`)
      setInstallStatus('installed')
      toast({
        title: "Installation successful",
        description: `${title} has been installed successfully.`,
      })
    } catch (error) {
      console.error(`❌ Failed to install server: ${id}`, error)
      setInstallStatus('install') // Reset button to install state
      
      // Check if the error is about Smithery CLI not being installed
      const errorMsg = error instanceof Error ? error.message : String(error)
      
      if (errorMsg.includes('timeout')) {
        toast({
          title: "Installation Timeout",
          description: `Die Installation wurde abgebrochen, weil sie zu lange dauerte. Bitte versuche es erneut oder führe den Befehl manuell aus.`,
          variant: "destructive"
        })
      } else if (errorMsg.includes('SIGINT') || errorMsg.includes('130')) {
        toast({
          title: "Installation Interaktion",
          description: `Die Installation benötigt manuellen Input. Bitte führe den Befehl manuell in einem Terminal aus.`,
          variant: "destructive"
        })
      } else if (errorMsg.includes('Smithery CLI') || errorMsg.includes('Node.js/npm')) {
        toast({
          title: "Node.js/npm benötigt",
          description: `Bitte stelle sicher, dass Node.js und npm installiert sind. Die Installation verwendet 'npx -y @smithery/cli@latest'.`,
          variant: "destructive"
        })
      } else {
        toast({
          title: "Installation failed",
          description: `Failed to install ${title}. Error: ${errorMsg.slice(0, 100)}${errorMsg.length > 100 ? '...' : ''}`,
          variant: "destructive"
        })
      }
    }
  }

  const getButtonContent = () => {
    switch (installStatus) {
      case 'install':
        return (
          <>
            <Download className="mr-2 h-4 w-4" />
            Install
          </>
        )
      case 'installing':
        return (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Installing...
          </>
        )
      case 'installed':
        return buttonHovered ? (
          <>
            <Trash className="mr-2 h-4 w-4" />
            Uninstall
          </>
        ) : (
          <>
            <Check className="mr-2 h-4 w-4" />
            Installed
          </>
        )
      default:
        return 'Install'
    }
  }

  return (
    <Card
      className="w-full h-[280px] overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-lg"
      onClick={handleCardClick}
    >
      <CardContent className="p-4 h-full flex flex-col">
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={imageSrc} />
            <AvatarFallback>{title[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{title}</h3>
            <p className="text-xs text-gray-500 truncate">by {creator}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 mb-auto line-clamp-4 transition-all duration-200">
          {description}
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 max-h-[28px] overflow-hidden">
                {tags.map((tag, index) => (
                  <Tag key={index} name={tag} />
                ))}
              </div>
            </div>
          </div>
          <Button
            variant={installStatus === 'installed' ? 'outline' : 'default'}
            size="sm"
            className="w-full"
            id={`install-status-${id}`}
            data-status={installStatus}
            onClick={handleInstallClick}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
          >
            {getButtonContent()}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
