import type { XftpSendApp } from './app';
import { XftpServerAddress } from './models';

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
            const response = await fetch('https://nlsfzgrapbkxbfekqalc.supabase.co/rest/v1/v_server_summaries?select=*&status=eq.true&country=neq.TOR&country=neq.YGGDRASIL&protocol=eq.2&uptime7=gte.0.9&order=uptime7.desc&offset=0&limit=1000&info_page_available=eq.true', {
                headers: {
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sc2Z6Z3JhcGJreGJmZWtxYWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1MDI0NDYsImV4cCI6MjA0MTA3ODQ0Nn0.SCGUD9n73Ya7yCqCfINvwtcYmr2OM30uNUYAfz0yMX4',
                    'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sc2Z6Z3JhcGJreGJmZWtxYWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1MDI0NDYsImV4cCI6MjA0MTA3ODQ0Nn0.SCGUD9n73Ya7yCqCfINvwtcYmr2OM30uNUYAfz0yMX4'
                }
            });
            if (!response.ok) return;
            const data = await response.json();
            
            const newServers: string[] = [];

            for (const s of data) {
                try {
                    const addrStr = `xftp://${s.identity}@${s.host}`;
                    const addr = XftpServerAddress.create(addrStr);
                    newServers.push(addrStr);
                    
                    if (!this.app.listServers().find(srv => srv.server.address === addrStr)) {
                        // Launch the addition dynamically so it doesn't block the loop sequentially
                        this.app.addServer(addr).catch(() => {});
                    }
                } catch {
                    // ignore parse errors
                }
            }

            this.activeCommunityServers = Array.from(new Set([...this.activeCommunityServers, ...newServers]));
            this.saveState();
        } catch (e) {
            console.error(e);
        }
    }
}
