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

import { createCryptoBackend, type CryptoBackend } from "./xftp-web/web/crypto-backend";
import { newXFTPAgent, closeXFTPAgent, uploadFile, encodeDescriptionURI, decodeDescriptionURI, resolveRedirect, downloadFileRaw } from "./xftp-web/src/agent";
import { formatXFTPServer, parseXFTPServer, getDescriptionServers } from "./xftp-web/src/protocol/address";
import type { EncryptedFileMetadata } from "./xftp-web/src/agent";
import type { FileDescription } from "./xftp-web/src/protocol/description";
import { prepareChunkSizes } from "./xftp-web/src/protocol/chunks";

import { downloadXFTPChunkRaw } from "./xftp-web/src/client";
import { decryptReceivedChunk } from "./xftp-web/src/download";
import { parseFileHeader } from "./xftp-web/src/crypto/file";
import { decodePrivKeyEd25519, ed25519KeyPairFromSeed } from "./xftp-web/src/crypto/keys";
import { sbInit, sbDecryptChunk } from "./xftp-web/src/crypto/secretbox";
import sodium from "libsodium-wrappers-sumo";

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
    } catch(e) {}
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
        const response = await fetch(`https://${server.server.url.hostname}`, { method: "OPTIONS" }).catch(() => null);
        server.status = response ? response.ok : false;
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
    const activeServers = this.servers
      .filter((s) => s.enabled && s.status === true)
      .map((s) => s.server);

    if (activeServers.length === 0)
      throw new Error("No active servers available for upload");

    const emitter = new EventEmitter<{ progress: (data: FileTransferStatus) => void; }>();
    const agent = newXFTPAgent();
    
    // Predict chunk counts
    const estimatedPayloadSize = file.size + 1024 + 8 + 16;
    const estimatedChunks = prepareChunkSizes(estimatedPayloadSize);
    const neededServersCount = Math.min(activeServers.length, estimatedChunks.length);
    const shuffledActive = [...activeServers].sort(() => 0.5 - Math.random());
    const selectedServers = shuffledActive.slice(0, neededServersCount);
        
    let backend: CryptoBackend;

    const promise = new Promise<FileDescriptor>(async (resolve, reject) => {
      try {
        const fileData = new Uint8Array(await file.arrayBuffer());
                
        let progressMap: FileChunkStatus[] = selectedServers.map((s) => ({ server: s, progress: { min: 0, max: 100, current: 0 } }));
        setTimeout(() => emitter.emit("progress", progressMap), 0);
                
        const updateProgress = (phasePercentage: number) => {
          progressMap.forEach(r => r.progress.current = phasePercentage * 100);
          emitter.emit("progress", progressMap);
        };

        const ENCRYPT_WEIGHT = fileData.length > 102400 ? 0.15 : 0;

        backend = createCryptoBackend();
        const encrypted = await backend.encrypt(fileData, file.name, (done, total) => {
          updateProgress((done / total) * ENCRYPT_WEIGHT);
        });

        const metadata: EncryptedFileMetadata = {
          digest: encrypted.digest,
          key: encrypted.key,
          nonce: encrypted.nonce,
          chunkSizes: encrypted.chunkSizes
        };

        const xftpServers = selectedServers.map(s => parseXFTPServer(s.address));

        const result = await uploadFile(agent, xftpServers, metadata, {
          readChunk: (off, sz) => backend.readChunk(off, sz),
          onProgress: (uploaded, total) => {
             updateProgress(ENCRYPT_WEIGHT + (uploaded / total) * (1 - ENCRYPT_WEIGHT));
          }
        });

        // We return the raw uri generated by uploadFile (no manifest wrapper)
        resolve(result.uri);
      } catch (e) {
        reject(e);
      } finally {
        if (backend) await backend.cleanup().catch(() => {});
        closeXFTPAgent(agent);
      }
    });

    return { promise, events: emitter as any };
  }

  async getPrimaryDownloadPlan(descriptor: FileDescriptor): Promise<PrimaryDownloadPlan> {
    const fd = decodeDescriptionURI(descriptor);
    console.log(fd);
    const servers = getDescriptionServers(fd);
    return {
      address: {
        server: XftpServerAddress.create(servers.length > 0 ? formatXFTPServer(servers[0]) : "xftp://mock@server"),
        path: ""
      },
      _fd: fd
    };
  }

  async getFinalDownloadPlan(primaryDownloadPlan: PrimaryDownloadPlan): Promise<FinalDownloadPlan> {
    const fd = primaryDownloadPlan._fd;
    if (!fd) throw new Error("Metadata descriptor missing from primary plan");

    const agent = newXFTPAgent();
    try {
      let resolvedFd: FileDescription = fd;
      if (fd.redirect !== null) {
        resolvedFd = await resolveRedirect(agent, fd);
      }

      // Hack to retrieve the filename BEFORE downloading the whole file
      // We pull ONLY the first chunk and extract its header.
      let recoveredFilename = "";
      try {
        await sodium.ready;
        const firstChunkMeta = resolvedFd.chunks.find(c => c.chunkNo === 1);
        if (firstChunkMeta && firstChunkMeta.replicas[0]) {
          const replica = firstChunkMeta.replicas[0];
          const server = parseXFTPServer(replica.server);
          const seed = decodePrivKeyEd25519(replica.replicaKey);
          const kp = ed25519KeyPairFromSeed(seed);
          const raw = await downloadXFTPChunkRaw(agent, server, kp.privateKey, replica.replicaId);
          const transportDecrypted = decryptReceivedChunk(raw.dhSecret, raw.nonce, raw.body, firstChunkMeta.digest);
          // Now we must do FILE-level decryption on the first chunk to reveal the header
          const fileState = sbInit(resolvedFd.key, resolvedFd.nonce);
          const fileLevelPlaintext = sbDecryptChunk(fileState, transportDecrypted);
          
          // First 8 bytes are the total length (int64), then comes the FileHeader
          const { header } = parseFileHeader(fileLevelPlaintext.subarray(8));
          recoveredFilename = header.fileName;
        }
      } catch (e) {
        console.warn("Could not pre-fetch chunk 1 for filename", e);
      }

      return {
        addresses: getDescriptionServers(resolvedFd).map(s => ({
            server: XftpServerAddress.create(formatXFTPServer(s)),
            path: ""
        })),
        filename: recoveredFilename,
        size: resolvedFd.size,
        _resolvedFd: resolvedFd
      };
    } finally {
      closeXFTPAgent(agent);
    }
  }

  async downloadFile(finalDownloadPlan: FinalDownloadPlan): Promise<FileProgress<File>> {
    const fd = finalDownloadPlan._resolvedFd;
    if (!fd) throw new Error("Resolved descriptor missing from final plan");

    const emitter = new EventEmitter<{ progress: (data: FileTransferStatus) => void; }>();
    const backend = createCryptoBackend();
    const agent = newXFTPAgent();

    const promise = new Promise<File>(async (resolve, reject) => {
      try {
        const DECRYPT_WEIGHT = fd.size >= 102400 ? 0.15 : 0;
        let progressMap: FileChunkStatus[] = finalDownloadPlan.addresses.map(a => ({ server: a.server, progress: { min: 0, max: 100, current: 0 } }));
        setTimeout(() => emitter.emit("progress", progressMap), 0);
        
        const updateProgress = (phasePercentage: number) => {
          progressMap.forEach(r => r.progress.current = phasePercentage * 100);
          emitter.emit("progress", progressMap);
        };

        const resolvedFd = await downloadFileRaw(agent, fd, async (raw) => {
          await backend.decryptAndStoreChunk(
            raw.dhSecret, raw.nonce, raw.body, raw.digest, raw.chunkNo
          );
        }, {
          onProgress: (downloaded, total) => {
            updateProgress((downloaded / total) * (1 - DECRYPT_WEIGHT));
          }
        });

        const { header, content } = await backend.verifyAndDecrypt({
          size: resolvedFd.size,
          digest: resolvedFd.digest,
          key: resolvedFd.key,
          nonce: resolvedFd.nonce
        }, (done, total) => {
          updateProgress(Math.min(0.99, (1 - DECRYPT_WEIGHT) + (done / total) * DECRYPT_WEIGHT));
        });

        updateProgress(1.0);

        let s = header.fileName || finalDownloadPlan.filename;
        s = s.replace(/[/[\\]/g, '').replace(/[\x00-\x1f\x7f]/g, '_').replace(/[\u202a-\u202e\u2066-\u2069]/g, '');
        if (s.length > 255) s = s.slice(0, 255);
        const sanitizeFileName = s || 'download';

        const file = new File([content.buffer as ArrayBuffer], sanitizeFileName, {
          type: "application/octet-stream",
        });

        resolve(file);
      } catch (e) {
        reject(e);
      } finally {
        await backend.cleanup().catch(() => {});
        closeXFTPAgent(agent);
      }
    });

    return { promise, events: emitter as any };
  }
}
