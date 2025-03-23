# Smithery Registry Integration for MCP Manager

## Overview

This application now supports Smithery Registry API for discovering and connecting to MCP servers. Smithery Registry provides access to a wide range of high-quality MCP servers with WebSocket support.

## Getting Started

### 1. Get a Smithery API Key

1. Visit [Smithery](https://smithery.ai) and log in or create an account
2. Click on your profile icon and select "API Keys" from the dropdown menu
3. Create a new API key and copy it

### 2. Configure the Environment Variable

Set the `VITE_SMITHERY_API_KEY` environment variable before launching the application:

```bash
# For Linux/macOS
export VITE_SMITHERY_API_KEY=your_api_key_here
npm start

# For Windows (PowerShell)
$env:VITE_SMITHERY_API_KEY="your_api_key_here"
npm start

# For Windows (Command Prompt)
set VITE_SMITHERY_API_KEY=your_api_key_here
npm start
```

### 3. Using Smithery Servers

1. Once the application is running with your API key, navigate to the Discover page
2. Browse the available servers from Smithery Registry
3. Click on a server to view details
4. In the server details page, navigate to the "Smithery" tab to see connection information
5. You can copy the WebSocket URL to use with any MCP client

## Configuration

Smithery servers may require specific configuration to connect. In the server details page, you'll find:

- **Qualified Name**: The unique identifier for the server
- **Deployment URL**: The base URL for server connections
- **Connections**: Details about how to connect to the server
  - **URL**: The WebSocket URL
  - **Config Schema**: JSON schema defining configuration options needed for the server

To create a proper WebSocket URL with configuration, use the format:
```
{base_url}?config={base64_encoded_config_json}
```

The application handles this formatting for you when you click "Copy" on the connection URL.

## Troubleshooting

- If you see no servers listed, verify your API key is correctly set
- Make sure your network allows connections to Smithery domains
- Check that your API key has the necessary permissions

## Support

For any issues or questions about Smithery, visit [Smithery Support](https://smithery.ai/support) or join their Discord community. 