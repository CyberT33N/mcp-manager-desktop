import { ClientType } from '@shared/constants'

export interface McpmServer {
  id: string
  name: string
  installedDate: string
  status: 'enabled' | 'disabled'
  version: string
  client?: ClientType // Store the client used for installation
}

export interface SmitheryCommandResult {
  success: boolean
  output: string
  error?: string
} 