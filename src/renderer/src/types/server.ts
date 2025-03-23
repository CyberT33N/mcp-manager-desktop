import { RegistryMCPServerItem } from '@shared/types'

export interface MCPServerCardData {
  registryInfo: RegistryMCPServerItem;
  isInstalled: boolean;
}

export interface ServerRegistryItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  creator: string;
  logoUrl?: string;
  publishDate: string;
  rating: number;
  type: string;
  features?: {
    services?: {
      cdn?: boolean;
      ddos?: boolean;
      analytics?: boolean;
    };
    capabilities?: Record<string, string[] | Record<string, any>>;
  };
}

// New Smithery types
export interface SmitheryServerConnection {
  type: string;
  url?: string;
  configSchema: any;
}

export interface SmitheryServerItem {
  qualifiedName: string;
  displayName: string;
  description: string;
  homepage: string;
  useCount: string;
  isDeployed: boolean;
  createdAt: string;
}

export interface SmitheryServerDetail {
  qualifiedName: string;
  displayName: string;
  deploymentUrl: string;
  connections: SmitheryServerConnection[];
}
