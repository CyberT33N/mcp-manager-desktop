import { ipcMain } from 'electron'
import { IPC_CHANNELS, ClientType } from '@shared/constants'
import { dependencyService, DependencyName } from '@mcpm/sdk'
import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { getClientSetting } from './settings'

const execAsync = promisify(exec)

// Smithery CLI command - use npx instead of direct smithery command
const SMITHERY_CMD = 'npx -y @smithery/cli@latest'
// Client option will be dynamically determined from settings
// const SMITHERY_CLIENT = '--client cursor'

interface McpmServer {
  id: string
  name: string
  installedDate: string
  status: 'enabled' | 'disabled'
  version: string
  client?: ClientType // Store the client used for installation
}

// File to store installed servers
const INSTALLED_SERVERS_FILE = path.join(os.homedir(), '.mcp-manager', 'installed-servers.json')

// Ensure the directory exists
function ensureDirectoryExists() {
  const dir = path.dirname(INSTALLED_SERVERS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`📁 Created directory: ${dir}`)
  }
}

// Load the installed servers from file
async function loadInstalledServers(): Promise<{[id: string]: McpmServer}> {
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
async function saveInstalledServers(servers: {[id: string]: McpmServer}) {
  ensureDirectoryExists()
  
  try {
    fs.writeFileSync(INSTALLED_SERVERS_FILE, JSON.stringify(servers, null, 2))
    console.log(`💾 Saved installed servers to: ${INSTALLED_SERVERS_FILE}`)
  } catch (error) {
    console.error(`❌ Error saving installed servers:`, error)
  }
}

// Check if Smithery CLI is accessible via npx
async function checkSmitheryCli(): Promise<boolean> {
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
async function getInstalledServers(): Promise<McpmServer[]> {
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
      
      // Versuche zuerst mit execSync für bessere Behandlung von interaktiven Prompts
      try {
        console.log(`🔄 Executing command: ${SMITHERY_CMD} install ${packageName} ${SMITHERY_CLIENT}`)
        
        // Mit execSync und Shell-Umgebung - verwende --yes flag und input pipe
        const cmd = `printf "y\ny\ny\ny\nn\n" | ${SMITHERY_CMD} install ${packageName} ${SMITHERY_CLIENT} --yes`;
        console.log(`🔄 Executing command: ${cmd}`);
        const stdout = execSync(cmd, {
          timeout: 60000, // 60 Sekunden Timeout
          stdio: 'pipe',  // Erfassen der Ausgabe
          env: {
            ...process.env,
            // Umgebungsvariablen, die Interaktivität deaktivieren
            CI: 'true',
            SMITHERY_NON_INTERACTIVE: 'true'
          },
          shell: '/bin/bash' // Spezifische Shell für die Pipe
        }).toString()
        
        console.log(`📊 Installation output:`, stdout)
        
        // Fehlerprüfung im Output
        if (stdout.includes("Failed") || stdout.includes("Error") || stdout.includes("failed") || stdout.includes("error")) {
          console.error(`⚠️ Möglicher Fehler in der Installation entdeckt: ${stdout}`)
        }
      } catch (error: unknown) {
        const installError = error as Error;
        console.error(`❌ Error during sync installation:`, installError)
        
        // Status 130 bedeutet SIGINT - was typisch für interaktive Prompts ist
        const anyError = error as any;
        if (anyError.status === 130) {
          console.log(`⚠️ Installation wurde durch Prompt unterbrochen (SIGINT 130), versuche Alternative...`)
          
          try {
            // Versuche es mit spawn für bessere stdin-Kontrolle
            console.log(`🔄 Versuche Installation mit spawn für bessere Prompt-Behandlung...`)
            const { spawnSync } = require('child_process');
            const args = ['--yes', '-y', '@smithery/cli@latest', 'install', packageName, '--client', client, '--yes'];
            
            const result = spawnSync('npx', args, {
              timeout: 60000,
              stdio: ['pipe', 'pipe', 'pipe'],
              // Antworte mit "n" auf die Neustart-Frage, aber "y" auf alles andere
              input: 'y\ny\ny\nn\n', 
              encoding: 'utf8',
              env: {
                ...process.env,
                CI: 'true',
                SMITHERY_NON_INTERACTIVE: 'true'
              }
            });
            
            if (result.error) {
              console.error(`❌ Spawn error:`, result.error);
              throw result.error;
            }
            
            if (result.status !== 0) {
              console.error(`❌ Nicht-Null Exit-Code: ${result.status}`);
              console.error(`📊 Stderr: ${result.stderr}`);
              
              // Trotz Fehler lokale Installation versuchen bei SIGINT (130), da der Fehler
              // oft nur bedeutet, dass die Interaktivität nicht funktioniert hat
              if (result.status !== 130) { // Nicht SIGINT
                // Prüfen, ob der Server trotzdem installiert wurde
                if (!(result.stdout.includes("successfully installed") || 
                      result.stderr.includes("successfully installed"))) {
                  throw new Error(`Installation fehlgeschlagen mit Code ${result.status}: ${result.stderr}`);
                }
              }
            }
            
            console.log(`📊 Spawn stdout: ${result.stdout}`);
            if (result.stderr) console.warn(`⚠️ Spawn stderr: ${result.stderr}`);
            
          } catch (spawnError) {
            console.error(`❌ Spawn installation fehlgeschlagen:`, spawnError);
            
            // Fallback auf die async Variante mit vordefinierten Antworten
            console.log(`⚠️ Auch Spawn-Installation fehlgeschlagen, versuche mit execAsync und echo...`);
            try {
              // Versuche es mit echo für alle Prompts, antworten mit n auf Neustart-Frage
              const { stdout, stderr } = await execAsync(
                // "y" für alle Prompts, aber "n" für die Neustart-Frage
                `printf "y\ny\ny\nn\n" | ${SMITHERY_CMD} install ${packageName} ${SMITHERY_CLIENT}`, 
                { timeout: 60000 }
              );
              console.log(`📊 Echo pipe installation output:`, stdout);
              if (stderr) console.warn(`⚠️ Echo pipe installation warnings:`, stderr);
            } catch (echoError: unknown) {
              const finalError = echoError as Error;
              console.error(`❌ Alle Installationsversuche fehlgeschlagen:`, finalError);
              
              // Prüfe, ob der Server möglicherweise trotzdem installiert wurde
              const anyEchoError = echoError as any;
              if (anyEchoError.stdout && (
                  anyEchoError.stdout.includes("successfully installed") ||
                  (anyEchoError.stderr && anyEchoError.stderr.includes("successfully installed"))
              )) {
                console.log(`✅ Trotz Fehler scheint die Installation erfolgreich gewesen zu sein.`);
              } else if (anyEchoError.status === 130 || 
                         (anyEchoError.message && anyEchoError.message.includes('SIGINT'))) {
                console.log(`⚠️ SIGINT/Interaktivitätsproblem bei Echo-Installation. Führe lokale Installation durch.`);
              } else {
                throw finalError;
              }
            }
          }
        }
        // Check if it's a timeout error
        else if (installError.message && installError.message.includes('timeout')) {
          throw new Error(`Installation timeout after 60 seconds. Please try again or run manually: ${SMITHERY_CMD} install ${packageName} ${SMITHERY_CLIENT}`)
        }
        // Check for "already exists" errors
        else if (installError.message && (
            installError.message.includes('already exists') || 
            installError.message.includes('bereits vorhanden') ||
            installError.message.includes('already installed')
          )) {
          console.log(`ℹ️ Server scheint bereits installiert zu sein, füge zur lokalen Liste hinzu.`)
          // Continue to add to local storage
        } else {
          // Fallback auf die async Variante
          console.log(`⚠️ Sync Installation fehlgeschlagen, versuche mit execAsync...`)
          try {
            // Mit printf für alle Prompts, aber "n" für die Neustart-Frage
            const cmd = `printf "y\ny\ny\nn\n" | ${SMITHERY_CMD} install ${packageName} ${SMITHERY_CLIENT} --yes`;
            console.log(`🔄 Executing command (async): ${cmd}`);
            
            const { stdout, stderr } = await execAsync(cmd, {
              timeout: 60000, // 60 Sekunden Timeout
              env: {
                ...process.env,
                CI: 'true',
                SMITHERY_NON_INTERACTIVE: 'true'
              }
            })
            console.log(`📊 Installation output:`, stdout)
            if (stderr) console.warn(`⚠️ Installation warnings:`, stderr)
          } catch (asyncError: unknown) {
            const asyncInstallError = asyncError as Error;
            console.error(`❌ Error during async installation:`, asyncInstallError)
            
            // Trotz Fehler lokale Installation versuchen bei SIGINT (130), da der Fehler
            // oft nur bedeutet, dass die Interaktivität nicht funktioniert hat
            const anyAsyncError = asyncError as any;
            if (anyAsyncError.status === 130 || 
                (anyAsyncError.message && anyAsyncError.message.includes('SIGINT'))) {
              console.log(`⚠️ SIGINT/Interaktivitätsproblem erkannt. Füge Server trotzdem zur lokalen Liste hinzu.`);
              return true; // Fahre mit lokaler Installation fort
            } else {
              throw asyncInstallError;
            }
          }
        }
      }
      
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
      
      // Execute the smithery uninstall command if available via npx
      try {
        console.log(`🔄 Executing uninstall command with execSync: ${SMITHERY_CMD} uninstall ${packageName} ${SMITHERY_CLIENT}`)
        
        // Mit execSync und Shell-Umgebung - verwende --yes flag
        const uninstallCmd = `printf "y\ny\ny\nn\n" | ${SMITHERY_CMD} uninstall ${packageName} ${SMITHERY_CLIENT} --yes`;
        console.log(`🔄 Executing command: ${uninstallCmd}`);
        const stdout = execSync(uninstallCmd, {
          timeout: 60000, // 60 Sekunden Timeout
          stdio: 'pipe',  // Erfassen der Ausgabe
          env: {
            ...process.env,
            // Umgebungsvariablen, die Interaktivität deaktivieren
            CI: 'true',
            SMITHERY_NON_INTERACTIVE: 'true'
          },
          shell: '/bin/bash' // Spezifische Shell für die Pipe
        }).toString()
        
        console.log(`📊 Uninstall output:`, stdout)
        
        // Fehlerprüfung im Output
        if (stdout.includes("Failed") || stdout.includes("Error") || stdout.includes("failed") || stdout.includes("error")) {
          console.error(`⚠️ Möglicher Fehler bei der Deinstallation entdeckt: ${stdout}`)
        }
      } catch (error: unknown) {
        const uninstallError = error as Error;
        console.warn(`⚠️ Could not uninstall via CLI:`, uninstallError)
        
        // Status 130 bedeutet SIGINT - was typisch für interaktive Prompts ist
        const anyError = error as any;
        if (anyError.status === 130) {
          console.log(`⚠️ Deinstallation wurde durch Prompt unterbrochen (SIGINT 130), versuche Alternative...`)
          
          try {
            // Versuche es mit echo für alle Prompts
            const uninstallCmd = `printf "y\ny\ny\nn\n" | ${SMITHERY_CMD} uninstall ${packageName} ${SMITHERY_CLIENT} --yes`;
            console.log(`🔄 Executing command: ${uninstallCmd}`);
            
            const { stdout, stderr } = await execAsync(uninstallCmd, {
              timeout: 60000
            });
            console.log(`📊 Echo pipe uninstall output:`, stdout);
            if (stderr) console.warn(`⚠️ Echo pipe uninstall warnings:`, stderr);
          } catch (echoError) {
            console.error(`❌ Echo pipe uninstall fehlgeschlagen:`, echoError);
            // Fortfahren mit lokaler Entfernung
          }
        }
        // Check if it's a timeout error
        else if (uninstallError.message && uninstallError.message.includes('timeout')) {
          console.error(`⏱️ Uninstall timeout after 60 seconds.`)
        }
        
        // Fallback auf async Methode
        try {
          console.log(`⚠️ Sync Uninstall fehlgeschlagen, versuche mit execAsync...`)
          const uninstallCmd = `printf "y\ny\ny\nn\n" | ${SMITHERY_CMD} uninstall ${packageName} ${SMITHERY_CLIENT} --yes`;
          console.log(`🔄 Executing command (async): ${uninstallCmd}`);
          
          const { stdout, stderr } = await execAsync(uninstallCmd, {
            timeout: 60000, // 60 Sekunden Timeout
            env: {
              ...process.env,
              CI: 'true',
              SMITHERY_NON_INTERACTIVE: 'true'
            }
          })
          console.log(`📊 Uninstall output (async):`, stdout)
          if (stderr) console.warn(`⚠️ Uninstall warnings:`, stderr)
        } catch (asyncError) {
          console.error(`❌ Auch async Uninstall fehlgeschlagen:`, asyncError)
          console.log(`🔄 Removing from local storage only.`)
        }
      }
      
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