import type { XftpSendApp } from './app';
import { XftpServerAddress } from './models';

const COMMUNITY_SERVERS_URL = import.meta.env.VITE_COMMUNITY_SERVERS_URL;

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class CommunityServersManager {
    private useCommunityServers = true;
    private activeCommunityServers: string[] = [];

    constructor(private app: XftpSendApp) {
        this.useCommunityServers = this.loadState();
        this.activeCommunityServers = this.loadServersState();
    }

    private loadState(): boolean {
        try {
            if (typeof localStorage !== "undefined") {
                const saved = localStorage.getItem("xftp-use-community");
                if (saved) {
                    return JSON.parse(saved) === true;
                }
            }
        } catch (e) {}
        return true;
    }

    private loadServersState(): string[] {
        try {
            if (typeof localStorage !== "undefined") {
                const saved = localStorage.getItem("xftp-community-added");
                if (saved) {
                    return JSON.parse(saved);
                }
            }
        } catch (e) {}
        return [];
    }

    private saveState(): void {
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("xftp-use-community", JSON.stringify(this.useCommunityServers));
                localStorage.setItem("xftp-community-added", JSON.stringify(this.activeCommunityServers));
            }
        } catch (e) {}
    }

    get isEnabled(): boolean {
        return this.useCommunityServers;
    }

    get serversList(): string[] {
        return this.activeCommunityServers;
    }

    async setEnabled(enabled: boolean): Promise<void> {
        this.useCommunityServers = enabled;
        this.saveState();
    }

    clear(): void {
        for (const addrStr of this.activeCommunityServers) {
            try {
                this.app.removeServer(XftpServerAddress.create(addrStr));
            } catch (e) {}
        }
        this.activeCommunityServers = [];
        this.saveState();
    }

    async refresh(): Promise<void> {
        try {
            if (!SUPABASE_ANON_KEY || !COMMUNITY_SERVERS_URL) {
                console.warn('Community servers configuration is incomplete.');
                return;
            }

            const response = await fetch(COMMUNITY_SERVERS_URL, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            if (!response.ok) return;
            const data = await response.json();
            
            const newServers: string[] = [];
            const newServerSet = new Set<string>();

            for (const s of data) {
                try {
                    const addrStr = `xftp://${s.identity}@${s.host}`;
                    const addr = XftpServerAddress.create(addrStr);
                    newServers.push(addrStr);
                    newServerSet.add(addrStr);
                    
                    if (!this.app.listServers().find(srv => srv.server.address === addrStr)) {
                        // Launch the addition dynamically so it doesn't block the loop sequentially
                        this.app.addServer(addr).catch(() => {});
                    }
                } catch {
                    // ignore parse errors
                }
            }

            for (const oldAddrStr of this.activeCommunityServers) {
                if (!newServerSet.has(oldAddrStr)) {
                    try {
                        this.app.removeServer(XftpServerAddress.create(oldAddrStr));
                    } catch (e) {}
                }
            }

            this.activeCommunityServers = newServers;
            this.saveState();
        } catch (e) {
            console.error(e);
        }
    }
}
