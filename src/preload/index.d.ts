import { ElectronAPI } from '@electron-toolkit/preload'

interface McpmAPI {
  install: (packageName: string) => Promise<unknown>
  uninstall: (packageName: string) => Promise<unknown>
  list: () => Promise<unknown>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      mcpm: McpmAPI
    }
  }
}
