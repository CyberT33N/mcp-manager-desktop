# mcp-mananger-desktop

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```






<br><br>
<br><br>
___
<br><br>
<br><br>


# FAQ

<details><summary>Click to expand..</summary>

# sandbox fix
```
sudo chown root:root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```
- Related to (https://electron-vite.org/guide/cli#preview-options) `The --noSandbox option will force Electron run without sandboxing. It is commonly used to enable Electron to run as root on Linux.`
  
</details>


