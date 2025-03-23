import { ElectronAPI } from '@electron-toolkit/preload'
import { ClientType } from '../../shared/constants'

export interface API {
  mcpm: {
    install: (packageName: string, client?: ClientType) => Promise<unknown>
    uninstall: (packageName: string, client?: ClientType) => Promise<unknown>
    list: () => Promise<unknown>
  }
  settings: {
    get: () => Promise<{ client: ClientType }>
    set: (settings: Record<string, unknown>) => Promise<{ success: boolean, settings: unknown }>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
} 