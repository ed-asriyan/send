import type { XftpSendApp } from './app';
import { XftpServerAddress } from './models';

// Base Supabase REST URL, e.g. "https://<project>.supabase.co/rest/v1"
const SUPABASE_REST_URL = import.meta.env.VITE_COMMUNITY_SERVERS_URL;

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Policy for which community servers get surfaced.
const REQUIRED_PROTOCOL = 2;
const MIN_UPTIME_7D = 0.9;
const SERVER_LIMIT = 1000;

interface ServerSummaryRow {
    server_uuid: string;
    last_server_status_uuid: string | null;
    uptime7: number | null;
}

interface StatusWithServerRow {
    uuid: string;
    servers: {
        server_hosts: { host: string } | null;
        server_identities: { identity: string } | null;
    } | null;
}

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

    private async fetchTable<T>(path: string, params: Record<string, string>): Promise<T[]> {
        const url = new URL(`${SUPABASE_REST_URL}/${path}`);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        const response = await fetch(url.toString(), {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (!response.ok) return [];
        return response.json();
    }

    async refresh(): Promise<void> {
        try {
            if (!SUPABASE_ANON_KEY || !SUPABASE_REST_URL) {
                console.warn('Community servers configuration is incomplete.');
                return;
            }

            // 1. Candidate servers ranked by 7-day uptime, from the summary view.
            const summaries = await this.fetchTable<ServerSummaryRow>('v_server_summaries', {
                select: 'server_uuid,last_server_status_uuid,uptime7',
                last_server_status_uuid: 'not.is.null',
                uptime7: `gte.${MIN_UPTIME_7D}`,
                order: 'uptime7.desc',
                offset: '0',
                limit: String(SERVER_LIMIT)
            });
            if (summaries.length === 0) {
                this.activeCommunityServers = [];
                this.saveState();
                return;
            }

            // 2. In one request, keep only the ones whose latest status is online, reachable, and
            // not from an excluded country, joining straight through to the server's host/identity
            // (real FK relationships: server_statuses -> servers -> server_hosts/server_identities).
            const statusUuids = [...new Set(summaries.map(s => s.last_server_status_uuid!))];
            const statuses = await this.fetchTable<StatusWithServerRow>('server_statuses', {
                select: 'uuid,servers!inner(server_hosts(host),server_identities(identity))',
                uuid: `in.(${statusUuids.join(',')})`,
                status: 'eq.true',
                info_page_available: 'eq.true',
                'servers.protocol': `eq.${REQUIRED_PROTOCOL}`
            });
            const byStatusUuid = new Map(statuses.map(s => [s.uuid, s]));

            const newServers: string[] = [];
            const newServerSet = new Set<string>();

            for (const summary of summaries) {
                const server = byStatusUuid.get(summary.last_server_status_uuid!)?.servers;
                if (!server?.server_hosts || !server?.server_identities) continue;

                try {
                    const addrStr = `xftp://${server.server_identities.identity}@${server.server_hosts.host}`;
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
