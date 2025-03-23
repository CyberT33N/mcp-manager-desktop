import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '../shared/constants'

// Custom APIs for renderer
const api = {
  mcpm: {
    install: (packageName: string, client?: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCPM_INSTALL, packageName, client),
    uninstall: (packageName: string, client?: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.MCPM_REMOVE, packageName, client),
    list: (): Promise<unknown> => ipcRenderer.invoke(IPC_CHANNELS.MCPM_LIST)
  },
  settings: {
    get: (): Promise<unknown> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (settings: Record<string, unknown>): Promise<unknown> => 
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
