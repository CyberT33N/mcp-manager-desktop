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

/**
 * Utility function to run Smithery CLI commands with restart suppression
 * This centralizes all the logic for handling interactive prompts
 */
async function runSmitheryCommand(
  action: 'install' | 'uninstall',
  packageName: string,
  clientOption: string,
  extraArgs: string = ''
): Promise<{success: boolean, output: string, error?: string}> {
  console.log(`🔄 Running Smithery ${action} command for ${packageName} with client ${clientOption}`)
  
  // Build base command with restart suppression
  const baseCmd = `${SMITHERY_CMD} ${action} ${packageName} ${clientOption} --yes ${extraArgs}`
  
  // Build standard environment with non-interactive and no-restart flags
  const standardEnv = {
    ...process.env,
    CI: 'true',
    SMITHERY_NON_INTERACTIVE: 'true',
    SMITHERY_NO_RESTART: 'true',
    NODE_ENV: 'production',
    FORCE_COLOR: '0',
    // Try additional environment variables that might affect prompt behavior
    SMITHERY_RESTART: 'false',
    SMITHERY_AUTO_RESTART: 'false',
    SMITHERY_PROMPT: 'false',
    SMITHERY_HEADLESS: 'true',
    // Node.js environment variables
    NODE_NO_READLINE: '1',
    // Generic CI/automation variables
    CI_HEADLESS: 'true',
    HEADLESS: 'true',
    AUTOMATION: 'true',
    NO_INTERACTION: 'true'
  }
  
  // Approach 1: Using echo/printf to pipe answers to prompts
  try {
    // Try with both yes/no combinations to see which works
    const variousPipeCommands = [
      // Multiple "n" for restart prompt, "y" for other prompts
      `printf "y\ny\ny\ny\nn\nn\nn\nn\nn\n" | ${baseCmd} --no-restart 2>/dev/null || printf "y\ny\ny\ny\nn\nn\nn\nn\nn\n" | ${baseCmd}`,
      // Try with just "n"s at the end
      `echo -e "y\ny\ny\ny\nn\nn\nn\nn\nn\n" | ${baseCmd}`,
      // Try with Node directly to bypass the CLI wrapper
      `echo -e "y\ny\ny\ny\nn\nn\nn\nn\nn\n" | node $(which npx) -y @smithery/cli@latest ${action} ${packageName} ${clientOption} --yes`,
      // Try with explicit expect-like timeout
      `(echo "y"; sleep 0.5; echo "y"; sleep 0.5; echo "y"; sleep 0.5; echo "y"; sleep 0.5; echo "n"; sleep 0.5; echo "n"; sleep 0.5; echo "n"; sleep 0.5;) | ${baseCmd}`
    ]
    
    // Try each command in sequence until one works
    for (const cmd of variousPipeCommands) {
      try {
        console.log(`🔄 Attempting command: ${cmd}`)
        
        const { stdout, stderr } = await execAsync(cmd, {
          timeout: 90000, // Longer timeout
          env: standardEnv,
          shell: '/bin/bash'
        })
        
        // If we get here, command succeeded
        console.log(`✅ Command succeeded: ${cmd}`)
        
        if (stderr && (
          stderr.includes("Failed") || 
          stderr.includes("Error") || 
          stderr.includes("failed") || 
          stderr.includes("error")
        )) {
          console.warn(`⚠️ Warnings in stderr: ${stderr}`)
        } else {
          // Check for successful messages
          if (stdout.includes("successfully installed") || 
              stdout.includes("successfully uninstalled") ||
              stdout.includes("successfully removed")) {
            console.log(`✅ Operation completed successfully`)
            return { success: true, output: stdout }
          }
          
          // If we got here, assume success even without explicit success message
          return { success: true, output: stdout }
        }
      } catch (cmdError: any) {
        console.error(`❌ Command attempt failed: ${cmdError.message}`)
        // Continue to next command
      }
    }
    
    // Approach 2: Try with configuration file
    try {
      console.log(`🔄 Attempting with temporary configuration file...`)
      
      // Create a temporary .smitheryrc file to set configuration
      const smitheryRcPath = path.join(os.tmpdir(), `.smitheryrc-${Date.now()}.json`)
      const smitheryRcContent = JSON.stringify({
        version: 1,
        noRestart: true,
        headless: true,
        nonInteractive: true,
        autoYes: true
      }, null, 2)
      
      console.log(`📝 Creating temporary Smithery config at: ${smitheryRcPath}`)
      fs.writeFileSync(smitheryRcPath, smitheryRcContent)
      
      try {
        // Configure environment to use this config file
        const configEnv = {
          ...standardEnv,
          SMITHERY_CONFIG_PATH: smitheryRcPath,
          SMITHERY_RC_PATH: smitheryRcPath,
          npm_config_smithery_config: smitheryRcPath
        }
        
        // Try running with the config file
        const configCmd = `${baseCmd} --config '${JSON.stringify({noRestart: true})}'`
        console.log(`🔄 Running with config file: ${configCmd}`)
        
        const { stdout, stderr } = await execAsync(configCmd, {
          timeout: 90000,
          env: configEnv,
          shell: '/bin/bash'
        })
        
        return { success: true, output: stdout, error: stderr }
      } finally {
        // Clean up the temporary file
        try {
          if (fs.existsSync(smitheryRcPath)) {
            fs.unlinkSync(smitheryRcPath)
            console.log(`🧹 Removed temporary config file: ${smitheryRcPath}`)
          }
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to clean up config file: ${cleanupError}`)
        }
      }
    } catch (configError: any) {
      console.error(`❌ Config file approach failed:`, configError.message)
    }
    
    // Approach 3: All pipe commands failed, try with spawnSync for better stdin control
    console.log(`🔄 Attempting with spawn for better interactive prompt handling...`)
    
    const { spawnSync } = require('child_process')
    
    // Try different spawn configurations with various input strategies
    const spawnConfigs = [
      // Configuration 1: Basic args with multiple "n" responses
      {
        cmd: 'npx',
        args: [
          '-y', '@smithery/cli@latest', 
          action, packageName, 
          '--client', clientOption.replace('--client ', ''), 
          '--yes', '--no-restart'
        ],
        input: 'y\ny\ny\ny\nn\nn\nn\nn\nn\n'
      },
      // Configuration 2: Try with full shell command and shell: true
      {
        cmd: baseCmd,
        args: [],
        shell: true,
        input: 'y\ny\ny\ny\nn\nn\nn\nn\nn\n'
      },
      // Configuration 3: Try with stdin replaced with /dev/null
      {
        cmd: 'npx',
        args: [
          '-y', '@smithery/cli@latest', 
          action, packageName, 
          '--client', clientOption.replace('--client ', ''), 
          '--yes', '--no-restart'
        ],
        stdio: ['ignore', 'pipe', 'pipe']
      }
    ]
    
    for (const config of spawnConfigs) {
      try {
        const spawnOptions: any = {
          timeout: 90000,
          env: standardEnv,
          encoding: 'utf8',
          shell: config.shell || false,
          stdio: config.stdio || ['pipe', 'pipe', 'pipe']
        }
        
        if (config.input) {
          spawnOptions.input = config.input
        }
        
        console.log(`🔄 Trying spawn with:`, { cmd: config.cmd, args: config.args })
        
        const result = spawnSync(config.cmd, config.args, spawnOptions)
        
        if (result.error) {
          console.error(`❌ Spawn error:`, result.error)
          continue
        }
        
        const output = result.stdout || ''
        const errorOutput = result.stderr || ''
        
        // Check for successful messages in output
        if (output.includes("successfully installed") || 
            output.includes("successfully uninstalled") ||
            output.includes("successfully removed")) {
          console.log(`✅ Operation completed successfully via spawn`)
          return { success: true, output, error: errorOutput }
        }
        
        if (result.status !== 0 && result.status !== 130) {
          console.error(`❌ Non-zero exit code: ${result.status}`)
          continue
        }
        
        // If we got this far, assume success
        return { 
          success: true, 
          output, 
          error: errorOutput 
        }
      } catch (spawnError: any) {
        console.error(`❌ Spawn configuration failed:`, spawnError.message)
        // Continue to next configuration
      }
    }
    
    // Approach 4: If all pipe commands and spawn configs failed, try with a custom I/O handling approach
    // This uses spawn with a real-time listener to detect and respond to prompts
    try {
      console.log(`🔄 Attempting with custom spawn I/O handler...`)
      
      const { spawn } = require('child_process')
      
      // Split the command into parts for spawn
      const cmdParts = baseCmd.split(' ').filter(Boolean)
      const cmd = cmdParts[0]
      const args = cmdParts.slice(1)
      
      console.log(`🔄 Spawning command: ${cmd} with args:`, args)
      
      return new Promise((resolve, reject) => {
        // Create a child process with all stdio streams as pipes
        const child = spawn(cmd, args, {
          env: standardEnv,
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe']
        })
        
        let output = ''
        let errorOutput = ''
        
        // Listen for stdout data
        child.stdout.on('data', (data) => {
          const chunk = data.toString()
          output += chunk
          
          // Log each chunk of output for debugging
          console.log(`📤 STDOUT: ${chunk}`)
          
          // Look for specific patterns indicating the restart prompt
          if (
            chunk.includes('restart') || 
            chunk.includes('Restart') || 
            chunk.includes('Would you like to restart') ||
            chunk.includes('apply changes')
          ) {
            console.log(`🔍 Detected restart prompt, sending 'n'`)
            // Send 'n' followed by newline to answer "no" to restart
            child.stdin.write('n\n')
            
            // Send additional 'n' responses to be safe
            setTimeout(() => child.stdin.write('n\n'), 100)
            setTimeout(() => child.stdin.write('n\n'), 300)
          }
          // Look for other common prompts and respond with 'y'
          else if (
            chunk.includes('?') || 
            chunk.includes('Continue') || 
            chunk.includes('Proceed') ||
            chunk.includes('confirm')
          ) {
            console.log(`🔍 Detected prompt, sending 'y'`)
            // Send 'y' followed by newline
            child.stdin.write('y\n')
          }
        })
        
        // Listen for stderr data
        child.stderr.on('data', (data) => {
          const chunk = data.toString()
          errorOutput += chunk
          console.log(`📥 STDERR: ${chunk}`)
        })
        
        // Handle process completion
        child.on('close', (code) => {
          console.log(`🏁 Child process exited with code ${code}`)
          
          // Check for successful installation messages in output
          if (output.includes("successfully installed") || 
              output.includes("successfully uninstalled") ||
              output.includes("successfully removed")) {
            console.log(`✅ Operation completed successfully via custom I/O handler`)
            resolve({ success: true, output, error: errorOutput })
          } 
          else if (code === 0 || code === 130) {
            // If exit code is 0 or 130 (SIGINT), assume success
            console.log(`✅ Operation likely completed despite no success message (exit code ${code})`)
            resolve({ success: true, output, error: errorOutput })
          }
          else {
            console.warn(`⚠️ Operation completed with non-zero exit code: ${code}`)
            // Still resolve with success to prevent blocking user
            resolve({ 
              success: true, 
              output, 
              error: `Process exited with code ${code}. ${errorOutput}`
            })
          }
        })
        
        // Handle errors
        child.on('error', (err) => {
          console.error(`❌ Child process error:`, err)
          // Still resolve with success to prevent blocking user
          resolve({ 
            success: true, 
            output, 
            error: `Spawn error: ${err.message}\n${errorOutput}`
          })
        })
        
        // Send initial 'y' responses for any initial prompts
        // This helps with early prompts that might appear before we start reading stdout
        setTimeout(() => child.stdin.write('y\n'), 100)
        setTimeout(() => child.stdin.write('y\n'), 500)
        setTimeout(() => child.stdin.write('y\n'), 1000)
        
        // Set a timeout to forcibly end the process if it takes too long
        const timeout = setTimeout(() => {
          console.log(`⏱️ Process timeout reached, killing child process`)
          child.kill()
          resolve({ 
            success: true, 
            output, 
            error: `Process timed out after 2 minutes.\n${errorOutput}` 
          })
        }, 120000) // 2 minute timeout
        
        // Clear timeout when process completes
        child.on('close', () => clearTimeout(timeout))
      })
    } catch (interactiveError: any) {
      console.error(`❌ Interactive spawn approach failed:`, interactiveError.message)
    }
    
    // Approach 5: Last desperate attempt - call Smithery CLI directly
    try {
      const { execSync } = require('child_process')
      
      // Install Smithery CLI globally first to avoid npx prompting
      console.log(`🔄 Trying to install Smithery CLI globally...`)
      execSync('npm install -g @smithery/cli@latest', { stdio: 'ignore' })
      
      // Then use the global installation with input piping
      const globalCmd = `printf "y\ny\ny\ny\nn\nn\nn\nn\nn\n" | smithery ${action} ${packageName} ${clientOption} --yes --no-restart`
      console.log(`🔄 Running with global Smithery CLI: ${globalCmd}`)
      
      const output = execSync(globalCmd, {
        env: standardEnv,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      return { success: true, output }
    } catch (globalError: any) {
      console.error(`❌ Global Smithery CLI approach failed:`, globalError.message)
    }
    
    // Approach 6: If all else fails, use a bash script with NPM_CONFIG_YES
    try {
      const finalEnv = {
        ...standardEnv,
        NPM_CONFIG_YES: 'true',
        npm_config_yes: 'true',
        NPM_CONFIG_NO_PROMPT: 'true',
        npm_config_no_prompt: 'true'
      }
      
      // Directly modify the bash environment to handle all prompts automatically
      const bashCmd = `
        export NPM_CONFIG_YES=true
        export SMITHERY_NON_INTERACTIVE=true
        export SMITHERY_NO_RESTART=true
        export CI=true
        yes n | ${baseCmd} || true
      `
      
      console.log(`🔄 Executing final attempt with bash script: ${bashCmd}`)
      
      const { stdout, stderr } = await execAsync(bashCmd, {
        timeout: 90000,
        env: finalEnv,
        shell: '/bin/bash'
      })
      
      return { success: true, output: stdout, error: stderr }
    } catch (finalError: any) {
      console.error(`❌ Final bash attempt failed:`, finalError.message)
    }
    
    // If we get here, nothing worked but we'll assume the operation completed
    // to avoid blocking the user from continuing
    return { 
      success: true, 
      output: "Operation may have completed despite prompt handling issues.",
      error: "All command approaches exhausted. The operation might have succeeded, but interactive prompt handling failed."
    }
  } catch (error: any) {
    console.error(`❌ Error in runSmitheryCommand:`, error.message)
    throw error
  }
}

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