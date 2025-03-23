import { IPC_CHANNELS } from '@shared/constants'
import { RegistryMCPServerItem } from '@shared/types'
import { ipcMain } from 'electron'

// API key for Smithery Registry
const VITE_SMITHERY_API_KEY = import.meta.env.VITE_SMITHERY_API_KEY || ''
const SMITHERY_BASE_URL = 'https://registry.smithery.ai'

export function setupRegistryHandlers() {
  // Log API key status at startup
  if (VITE_SMITHERY_API_KEY) {
    console.log(`✅ Smithery API-Key gefunden (Länge: ${VITE_SMITHERY_API_KEY.length})`)
    console.log(`🔑 Key beginnt mit: ${VITE_SMITHERY_API_KEY.substring(0, 4)}...`)
  } else {
    console.log(`❌ Kein Smithery API-Key konfiguriert - verwende MCPHub als Fallback`)
    console.log(`💡 Tipp: Setze VITE_SMITHERY_API_KEY in .env.local`)
  }
  
  ipcMain.handle(IPC_CHANNELS.FETCH_REGISTRY, async (_, query?: string) => {
    try {
      // Format query parameters for Smithery
      const params = new URLSearchParams()
      if (query) params.append('q', query)
      params.append('page', '1')
      params.append('pageSize', '20')
      
      const url = `${SMITHERY_BASE_URL}/servers?${params.toString()}`
      
      // If API key is missing, use MCPHub as fallback
      if (!VITE_SMITHERY_API_KEY) {
        console.log(`🔄 Verwende MCPHub für Serverabfrage: "${query || ''}"`)
        const mcphubUrl = query
          ? `https://registry.mcphub.io/search?q=${encodeURIComponent(query)}`
          : 'https://registry.mcphub.io/registry'
        const response = await fetch(mcphubUrl)
        if (!response.ok) {
          throw new Error(`❌ Fehler beim Abrufen von MCPHub: ${response.status} ${response.statusText}`)
        }
        const data = await response.json()
        console.log(`✅ ${data.length || 0} Server von MCPHub erhalten`)
        return data as RegistryMCPServerItem[]
      }
      
      console.log(`🔍 Suche Server von Smithery: "${query || ''}"`)
      
      const headers = {
        'Authorization': `Bearer ${VITE_SMITHERY_API_KEY}`,
        'Content-Type': 'application/json'
      }
      
      const response = await fetch(url, {
        headers
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          console.error(`❌ Authentifizierung fehlgeschlagen (401 Unauthorized)`)
          console.error(`💡 Überprüfe, ob dein VITE_SMITHERY_API_KEY korrekt ist`)
        }
        throw new Error(`❌ Fehler beim Abrufen der Server: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log(`✅ ${data.servers?.length || 0} Server von Smithery erhalten`)
      
      // Map Smithery response to our app's format
      return data.servers.map((server: any) => ({
        id: server.qualifiedName,
        title: server.displayName,
        description: server.description,
        tags: [], // Smithery doesn't provide tags directly
        creator: server.qualifiedName.split('/')[0], // Use owner part of qualifiedName
        logoUrl: '', // Smithery doesn't provide logos directly
        publishDate: server.createdAt,
        rating: 5, // Default rating
        type: 'ws', // Assuming WebSocket as default for Smithery
        isDeployed: server.isDeployed
      })) as RegistryMCPServerItem[]
    } catch (error) {
      console.error('❌ Fehler beim Abrufen des Registrys:', error)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.FETCH_SERVER_DETAIL, async (_, id: string) => {
    try {
      // If API key is missing, use MCPHub as fallback
      if (!VITE_SMITHERY_API_KEY) {
        console.log(`🔄 Verwende MCPHub für Server-Details: "${id}"`)
        const response = await fetch(`https://registry.mcphub.io/registry/${id}`)
        if (!response.ok) {
          throw new Error(`❌ Fehler beim Abrufen von MCPHub: ${response.status} ${response.statusText}`)
        }
        return await response.json()
      }
      
      console.log(`🔍 Suche Server-Details von Smithery: "${id}"`)
      
      const response = await fetch(`${SMITHERY_BASE_URL}/servers/${id}`, {
        headers: {
          'Authorization': `Bearer ${VITE_SMITHERY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          console.error(`❌ Authentifizierung fehlgeschlagen (401 Unauthorized)`)
          console.error(`💡 Überprüfe, ob dein VITE_SMITHERY_API_KEY korrekt ist`)
        }
        throw new Error(`❌ Fehler beim Abrufen der Server-Details: ${response.status} ${response.statusText}`)
      }
      
      const smitheryServer = await response.json()
      console.log('✅ Server-Details von Smithery erhalten')
      
      // Transform the Smithery response to match our app's expected format
      return {
        id: smitheryServer.qualifiedName,
        title: smitheryServer.displayName,
        description: smitheryServer.qualifiedName, // Using qualifiedName as description
        tags: [], // No direct tags from Smithery
        creator: smitheryServer.qualifiedName.split('/')[0], // Owner from qualified name
        logoUrl: '', // No direct logo from Smithery
        publishDate: new Date().toISOString(), // Current date as Smithery doesn't provide this
        rating: 5, // Default rating
        type: 'ws', // Default to WebSocket for Smithery
        commandInfo: {
          command: '',
          args: [],
          env: {}
        },
        defVersion: '1.0',
        parameters: {},
        // Include Smithery-specific data
        smithery: {
          qualifiedName: smitheryServer.qualifiedName,
          deploymentUrl: smitheryServer.deploymentUrl,
          connections: smitheryServer.connections
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Server-Details:', error)
      throw error
    }
  })
}
