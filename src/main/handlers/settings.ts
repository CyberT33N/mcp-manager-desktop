import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { IPC_CHANNELS, VALID_CLIENTS, ClientType } from '@shared/constants'

// Default settings
const DEFAULT_SETTINGS = {
  client: 'cursor' as ClientType
}

// Settings file path
const SETTINGS_FILE = path.join(os.homedir(), '.mcp-manager', 'settings.json')

// Ensure the directory exists
function ensureDirectoryExists() {
  const dir = path.dirname(SETTINGS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`📁 Created settings directory: ${dir}`)
  }
}

// Load settings from file
async function loadSettings(): Promise<typeof DEFAULT_SETTINGS> {
  ensureDirectoryExists()
  
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8')
      console.log(`📖 Loaded settings from: ${SETTINGS_FILE}`)
      
      try {
        const settings = JSON.parse(data)
        return { ...DEFAULT_SETTINGS, ...settings }
      } catch (parseError) {
        console.error(`❌ Could not parse settings JSON, using defaults:`, parseError)
        // Create backup of corrupted file
        const backupPath = `${SETTINGS_FILE}.backup.${Date.now()}`
        fs.writeFileSync(backupPath, data)
        console.log(`📦 Created backup of corrupted file: ${backupPath}`)
        return { ...DEFAULT_SETTINGS }
      }
    }
  } catch (error) {
    console.error(`❌ Error loading settings:`, error)
  }
  
  // If file doesn't exist or there was an error, return defaults and save them
  saveSettings(DEFAULT_SETTINGS)
  return { ...DEFAULT_SETTINGS }
}

// Save settings to file
async function saveSettings(settings: typeof DEFAULT_SETTINGS) {
  ensureDirectoryExists()
  
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    console.log(`💾 Saved settings to: ${SETTINGS_FILE}`)
    return true
  } catch (error) {
    console.error(`❌ Error saving settings:`, error)
    return false
  }
}

// Setup settings handlers
export function setupSettingsHandlers() {
  console.log('🔌 Setting up settings handlers...')
  
  // Get settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    console.log('📜 Handling GET_SETTINGS request')
    try {
      const settings = await loadSettings()
      console.log(`✅ Successfully returning settings`)
      return settings
    } catch (error) {
      console.error('❌ Error in GET_SETTINGS handler:', error)
      throw error
    }
  })
  
  // Set settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_, newSettings: Partial<typeof DEFAULT_SETTINGS>) => {
    console.log('📝 Handling SET_SETTINGS request', newSettings)
    try {
      // Validate client setting if provided
      if (newSettings.client && !VALID_CLIENTS.includes(newSettings.client as ClientType)) {
        throw new Error(`Invalid client: ${newSettings.client}. Valid options are: ${VALID_CLIENTS.join(', ')}`)
      }
      
      const currentSettings = await loadSettings()
      const mergedSettings = { ...currentSettings, ...newSettings }
      
      const success = await saveSettings(mergedSettings)
      console.log(`✅ Successfully updated settings`)
      return { success, settings: mergedSettings }
    } catch (error) {
      console.error('❌ Error in SET_SETTINGS handler:', error)
      throw error
    }
  })
  
  console.log('✅ All settings handlers successfully registered!')
}

// Get client setting for use in other modules
export async function getClientSetting(): Promise<ClientType> {
  const settings = await loadSettings()
  return settings.client
} 