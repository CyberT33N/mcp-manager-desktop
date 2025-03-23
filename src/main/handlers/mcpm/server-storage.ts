import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { McpmServer } from './types'

// File to store installed servers
export const INSTALLED_SERVERS_FILE = path.join(os.homedir(), '.mcp-manager', 'installed-servers.json')

// Ensure the directory exists
export function ensureDirectoryExists() {
  const dir = path.dirname(INSTALLED_SERVERS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`📁 Created directory: ${dir}`)
  }
}

// Load the installed servers from file
export async function loadInstalledServers(): Promise<{[id: string]: McpmServer}> {
  ensureDirectoryExists()
  
  try {
    if (fs.existsSync(INSTALLED_SERVERS_FILE)) {
      try {
        const data = fs.readFileSync(INSTALLED_SERVERS_FILE, 'utf8')
        console.log(`📖 Loaded installed servers from: ${INSTALLED_SERVERS_FILE}`)
        
        // Versuche die Daten zu parsen, aber fange Fehler ab
        try {
          return JSON.parse(data) || {}
        } catch (parseError) {
          console.error(`❌ Konnte JSON nicht parsen, erstelle neues Objekt:`, parseError)
          // Backup der kaputten Datei erstellen
          const backupPath = `${INSTALLED_SERVERS_FILE}.backup.${Date.now()}`
          fs.writeFileSync(backupPath, data)
          console.log(`📦 Backup der kaputten Datei erstellt: ${backupPath}`)
          return {}
        }
      } catch (readError) {
        console.error(`❌ Fehler beim Lesen der Datei:`, readError)
        return {}
      }
    }
  } catch (error) {
    console.error(`❌ Error loading installed servers:`, error)
  }
  
  return {}
}

// Save the installed servers to file
export async function saveInstalledServers(servers: {[id: string]: McpmServer}) {
  ensureDirectoryExists()
  
  try {
    fs.writeFileSync(INSTALLED_SERVERS_FILE, JSON.stringify(servers, null, 2))
    console.log(`💾 Saved installed servers to: ${INSTALLED_SERVERS_FILE}`)
  } catch (error) {
    console.error(`❌ Error saving installed servers:`, error)
  }
} 