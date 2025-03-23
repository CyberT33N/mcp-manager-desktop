import { exec } from 'child_process'
import { promisify } from 'util'
import { McpmServer } from './types'
import { loadInstalledServers } from './server-storage'
import { SMITHERY_CMD } from './smithery-commands'

const execAsync = promisify(exec)

// Check if Smithery CLI is accessible via npx
export async function checkSmitheryCli(): Promise<boolean> {
  try {
    console.log(`🔍 Checking for Smithery CLI via npx...`)
    // Use help instead of version, as version requires a client parameter
    await execAsync(`${SMITHERY_CMD} --help`)
    console.log(`✅ Smithery CLI found via npx`)
    return true
  } catch (error) {
    console.error(`❌ Smithery CLI not accessible via npx:`, error)
    console.error(`💡 Make sure Node.js and npm are installed`)
    return false
  }
}

// Get installed servers from both file and Smithery CLI
export async function getInstalledServers(): Promise<McpmServer[]> {
  console.log('📋 Fetching installed servers list')
  
  // Load saved servers from file
  const savedServers = await loadInstalledServers()
  
  // Try to check for installed servers with Smithery CLI
  // Note: Currently Smithery CLI doesn't have a direct way to list installed servers
  // We'll rely on our local JSON file for now
  try {
    // Check if CLI is accessible
    const smitheryAccessible = await checkSmitheryCli()
    
    if (smitheryAccessible) {
      console.log(`✅ Smithery CLI is accessible via npx`) 
      // In a future update, we might have a way to list installed servers from CLI
    }
  } catch (error) {
    console.error(`⚠️ Could not check Smithery CLI:`, error)
  }
  
  const serverList = Object.values(savedServers)
  console.log(`✅ Found ${serverList.length} installed servers`)
  return serverList
} 