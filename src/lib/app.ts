import { DEFAULT_SERVERS } from "./consts";
import type {
  Status,
  XftpServer,
  FileProgress,
  FileChunkStatus,
  FileTransferStatus,
  FileDescriptor,
  PrimaryDownloadPlan,
  FinalDownloadPlan,
  ProgressStatus,
} from "./models";
import { EventEmitter, XftpServerAddress } from "./models";

export class XftpSendApp {
  private servers: XftpServer[];

  constructor() {
    this.servers = this.loadServersFromStorage();
  }

  private loadServersFromStorage(): XftpServer[] {
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem("xftp-servers");
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.map((s: any) => ({
            server: XftpServerAddress.create(typeof s === "string" ? s : (s.server.address || s.server)),
            enabled: typeof s.enabled === "boolean" ? s.enabled : true,
            status: "checking" as Status,
          }));
        }
      }
    } catch(e) {
    }
    return DEFAULT_SERVERS.map((server) => ({
      server: XftpServerAddress.create(server),
      enabled: true,
      status: "checking" as Status,
    }));
  }

  private saveServersToStorage(): void {
    try {
      if (typeof localStorage !== "undefined") {
        const toSave = this.servers.map(s => ({
          server: s.server.address,
          enabled: s.enabled
        }));
        localStorage.setItem("xftp-servers", JSON.stringify(toSave));
      }
    } catch(e) {}
  }

  private async updateServerAvailability(index: number): Promise<XftpServer> {
    const server = this.servers[index];
    if (server) {
      try {
        server.status = "checking";
        const response = await fetch(`https://${server.server.getDomain()}`, { method: "OPTIONS" });
        console.log(`Checking server availability for ${server.server.getDomain()}`);
        console.log(`Response OK: ${response.ok}`); 
        server.status = response.ok;
      } catch (e) {
        server.status = false;
      }
      return server;
    } else {
      return Promise.reject(new Error("Server not found"));
    }
  }

  async addServer(address: XftpServerAddress): Promise<XftpServer> {
    const newSrv = {
      server: address,
      enabled: true,
      status: "checking" as Status,
    };
    this.servers.push(newSrv);
    this.saveServersToStorage();
    await this.updateServerAvailability(this.servers.indexOf(newSrv));
    return newSrv;
  }

  removeServer(address: XftpServerAddress): void {
    this.servers = this.servers.filter((s) => s.server.address !== address.address);
    this.saveServersToStorage();
  }

  listServers(): readonly XftpServer[] {
    return this.servers;
  }

  toggleServer(address: string, enabled: boolean): void {
    const srv = this.servers.find((s) => s.server.address === address);
    if (srv) {
      srv.enabled = enabled;
      this.saveServersToStorage();
    }
  }

  async refreshStatus(address: XftpServerAddress): Promise<Status> {
    const index = this.servers.findIndex((s) => s.server.address === address.address);
    if (index !== -1) {
      this.servers[index].status = "checking";
      const server = await this.updateServerAvailability(index);
      return server.status;
    } else {
      return Promise.reject(new Error("Server not found"));
    }
  }

  async sendFile(file: File): Promise<FileProgress<FileDescriptor>> {
    const emitter = new EventEmitter<{
      progress: (data: FileTransferStatus) => void;
    }>();
    const activeServers = this.servers
      .filter((s) => s.enabled && s.status === true)
      .map((s) => s.server);

    if (activeServers.length === 0)
      throw new Error("No active servers available for upload");

    let promise = new Promise<FileDescriptor>((resolve) => {
      let progressMap: FileChunkStatus[] = [];
      activeServers.forEach(
        (s) => (progressMap.push({ server: s, progress: { min: 0, max: 100, current: 0 } })),
      );

      const interval = setInterval(() => {
        let allDone = true;
        activeServers.forEach((s) => {
          const chunk = progressMap.find((c) => c.server.address === s.address);
          if (chunk && chunk.progress.current < chunk.progress.max) {
            chunk.progress.current += Math.floor(Math.random() * 15) + 1;
            if (chunk.progress.current > chunk.progress.max)
              chunk.progress.current = chunk.progress.max;
            allDone = false;
          }
        });

        emitter.emit("progress", progressMap);

        if (allDone) {
          clearInterval(interval);
          setTimeout(
            () =>
              resolve(
                `eyJmaWxlIjoibW9jay1kZXNjIiwiYnl0ZXMiOiR7ZmlsZS5zaXplfX0=_${Date.now().toString(36)}`,
              ),
            2500,
          );
        }
      }, 3300);
    });

    return { promise, events: emitter as any };
  }

  async getPrimaryDownloadPlan(
    descriptor: FileDescriptor,
  ): Promise<PrimaryDownloadPlan> {
    return new Promise((resolve) =>
      setTimeout(() => resolve({ address: { server: this.servers[Math.floor(Math.random() * this.servers.length)].server, path: "/mock/path" } }), 2500),
    );
  }

  // Изменена сигнатура: принимает PrimaryDownloadPlan, возвращает FinalDownloadPlan { addresses: string[] }
  async getFinalDownloadPlan(
    primaryDownloadPlan: PrimaryDownloadPlan,
  ): Promise<FinalDownloadPlan> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockServers = this.servers
          .map((s) => s.server);
        resolve({
          filename: "mock_file.txt",
          addresses: mockServers.map((server) => ({ server, path: "/mock/path" })),
        });
      }, 5000);
    });
  }

  // Изменена сигнатура: принимает FinalDownloadPlan
  async downloadFile(
    finalDownloadPlan: FinalDownloadPlan,
  ): Promise<FileProgress<File>> {
    const serversList = finalDownloadPlan.addresses;
    const emitter = new EventEmitter<{
      progress: (data: FileTransferStatus) => void;
    }>();

    let promise = new Promise<File>((resolve) => {
      let progressMap: FileChunkStatus[] = finalDownloadPlan.addresses.map(
        server => ({ server: server.server, progress: { min: 0, max: 100, current: 0 } })
      );

      const interval = setInterval(() => {
        let allDone = true;
        progressMap.forEach((chunk) => {
          if (chunk.progress.current < chunk.progress.max) {
            chunk.progress.current += Math.floor(Math.random() * 20) + 1;
            if (chunk.progress.current > chunk.progress.max)
              chunk.progress.current = chunk.progress.max;
            allDone = false;
          }
        });

        emitter.emit("progress", progressMap);

        if (allDone) {
          clearInterval(interval);
          setTimeout(() => {
            const content = "This is a mock decrypted file content.";
            const file = new File([content], "received_file.txt", {
              type: "text/plain",
            });
            resolve(file);
          }, 5000);
        }
      }, 2500);
    });

    return { promise, events: emitter as any };
  }
}
