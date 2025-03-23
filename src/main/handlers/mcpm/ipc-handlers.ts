import { ipcMain } from 'electron'
import { IPC_CHANNELS, ClientType } from '@shared/constants'
import { getClientSetting } from '../settings'
import { runSmitheryCommand } from './smithery-commands'
import { loadInstalledServers, saveInstalledServers } from './server-storage'
import { checkSmitheryCli, getInstalledServers } from './cli-utils'

export function setupMcpmHandlers() {
  console.log('🔌 Setting up MCPM handlers...')
  
  // Log all registered IPC channels for debugging
  console.log('📝 Registering MCPM_LIST IPC handler:', IPC_CHANNELS.MCPM_LIST)
  
  ipcMain.handle(IPC_CHANNELS.MCPM_LIST, async () => {
    console.log('📜 Handling MCPM_LIST request')
    try {
      const servers = await getInstalledServers()
      console.log(`✅ Successfully returning ${servers.length} installed servers`)
      return servers
    } catch (error) {
      console.error('❌ Error in MCPM_LIST handler:', error)
      throw error
    }
  })
  
  console.log('📝 Registering MCPM_INSTALL IPC handler:', IPC_CHANNELS.MCPM_INSTALL)
  ipcMain.handle(IPC_CHANNELS.MCPM_INSTALL, async (_, packageName: string, clientOverride?: ClientType) => {
    console.log(`📦 Installing package: ${packageName}`)
    try {
      // Check if Smithery CLI is accessible
      const smitheryAccessible = await checkSmitheryCli()
      
      if (!smitheryAccessible) {
        console.error(`❌ Smithery CLI nicht über npx erreichbar`)
        throw new Error("Node.js/npm benötigt! Bitte installieren Sie Node.js und führen Sie den Befehl 'npx -y @smithery/cli@latest' manuell aus.")
      }
      
      // Get client setting or use override if provided
      const client = clientOverride || await getClientSetting()
      const SMITHERY_CLIENT = `--client ${client}`
      
      // Log the start of installation
      console.log(`🔄 Installing server using Smithery CLI via npx: ${packageName} with client: ${client}`)
      
      // Use the centralized utility function for command execution
      const result = await runSmitheryCommand('install', packageName, SMITHERY_CLIENT)
      
      // Load current installed servers
      const savedServers = await loadInstalledServers()
      
      // Add the newly installed server
      savedServers[packageName] = {
        id: packageName,
        name: packageName.split('/').pop() || packageName,
        installedDate: new Date().toISOString(),
        status: 'enabled',
        version: '1.0.0', // Version might be available in the installation output
        client // Store the client used for installation
      }
      
      // Save updated server list
      await saveInstalledServers(savedServers)
      
      // Log successful installation
      console.log(`✅ Successfully installed ${packageName} with client ${client}`)
      
      return { 
        success: true,
        packageName,
        installedAt: new Date().toISOString(),
        version: '1.0.0',
        client
      }
    } catch (error) {
      console.error(`❌ Error installing ${packageName}:`, error)
      
      // Erlaube trotz Fehler Installation, wenn SIGINT/Status 130 
      const anyError = error as any;
      if (anyError.status === 130 || 
          (anyError.message && anyError.message && anyError.message.includes('SIGINT'))) {
        console.log(`⚠️ SIGINT erkannt - führe dennoch lokale Installation durch`);
        // Fortfahren mit lokaler Installation
      } else {
        throw error;
      }
    }
  })
  
  console.log('📝 Registering MCPM_REMOVE IPC handler:', IPC_CHANNELS.MCPM_REMOVE)
  ipcMain.handle(IPC_CHANNELS.MCPM_REMOVE, async (_, packageName: string, clientOverride?: ClientType) => {
    console.log(`🗑️ Removing package: ${packageName}`)
    try {
      // Check if Smithery CLI is accessible
      const smitheryAccessible = await checkSmitheryCli()
      
      if (!smitheryAccessible) {
        console.error(`❌ Smithery CLI nicht über npx erreichbar`)
        throw new Error("Node.js/npm benötigt! Bitte installieren Sie Node.js und führen Sie den Befehl 'npx -y @smithery/cli@latest' manuell aus.")
      }
      
      // Load current installed servers to check if we have client info
      const savedServers = await loadInstalledServers()
      
      // Determine which client to use for uninstallation
      // 1. Use the client specified in the override parameter
      // 2. Use the client that was used for installation if available
      // 3. Fallback to the current default client setting
      let client = clientOverride || 
                  (savedServers[packageName] && savedServers[packageName].client) || 
                  await getClientSetting()
      
      const SMITHERY_CLIENT = `--client ${client}`
      console.log(`🔄 Uninstalling package ${packageName} with client: ${client}`)
      
      // Use the centralized utility function for command execution
      const result = await runSmitheryCommand('uninstall', packageName, SMITHERY_CLIENT)
      
      // Remove the server from local storage
      if (savedServers[packageName]) {
        delete savedServers[packageName]
        
        // Save updated server list
        await saveInstalledServers(savedServers)
      }
      
      console.log(`✅ Successfully removed ${packageName}`)
      return { success: true }
    } catch (error) {
      console.error(`❌ Error removing ${packageName}:`, error)
      throw error
    }
  })
  
  console.log('📝 Registering MCPM_ENABLE IPC handler:', IPC_CHANNELS.MCPM_ENABLE)
  ipcMain.handle(IPC_CHANNELS.MCPM_ENABLE, async (_, packageName: string) => {
    console.log(`🔌 Enabling package: ${packageName}`)
    try {
      // Load current installed servers
      const savedServers = await loadInstalledServers()
      
      // Update server status
      if (savedServers[packageName]) {
        savedServers[packageName].status = 'enabled'
        
        // Save updated server list
        await saveInstalledServers(savedServers)
      }
      
      console.log(`✅ Successfully enabled ${packageName}`)
      return { success: true }
    } catch (error) {
      console.error(`❌ Error enabling ${packageName}:`, error)
      throw error
    }
  })
  
  console.log('📝 Registering MCPM_DISABLE IPC handler:', IPC_CHANNELS.MCPM_DISABLE)
  ipcMain.handle(IPC_CHANNELS.MCPM_DISABLE, async (_, packageName: string) => {
    console.log(`🔌 Disabling package: ${packageName}`)
    try {
      // Load current installed servers
      const savedServers = await loadInstalledServers()
      
      // Update server status
      if (savedServers[packageName]) {
        savedServers[packageName].status = 'disabled'
        
        // Save updated server list
        await saveInstalledServers(savedServers)
      }
      
      console.log(`✅ Successfully disabled ${packageName}`)
      return { success: true }
    } catch (error) {
      console.error(`❌ Error disabling ${packageName}:`, error)
      throw error
    }
  })
  
  console.log('✅ All MCPM handlers successfully registered!')
} 