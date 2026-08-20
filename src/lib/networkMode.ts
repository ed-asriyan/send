export enum NetworkMode {
  Clearnet = "clearnet",
  Tor = "tor",
  Yggdrasil = "yggdrasil",
}

export const NetworkIcons: Record<NetworkMode, string> = {
  [NetworkMode.Clearnet]: "🔒",
  [NetworkMode.Tor]: "🧅",
  [NetworkMode.Yggdrasil]: "🌳",
};

export function getCurrentNetworkMode(hostname: string = window.location.hostname): NetworkMode {
  if (hostname.endsWith(".onion")) {
    return NetworkMode.Tor;
  }
  
  if (hostname.endsWith(".ygg")) {
     return NetworkMode.Yggdrasil;
  }
  
  // Yggdrasil IPv6 range starts with 0200::/7
  const ipv6Match = hostname.match(/^\[?([0-9a-fA-F:]+)\]?$/);
  if (ipv6Match) {
    const ip = ipv6Match[1].toLowerCase();
    const prefix = ip.split(':')[0];
    if (/^0?[23][0-9a-f]{2}$/.test(prefix)) {
      return NetworkMode.Yggdrasil;
    }
  }

  return NetworkMode.Clearnet;
}

export function getCurrentNetworkIcon(): string {
  return NetworkIcons[getCurrentNetworkMode()];
}





