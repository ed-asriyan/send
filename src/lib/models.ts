export class EventEmitter<T = any> {
  private events: Record<string, ((...args: any[]) => void)[]>;

  constructor() {
    this.events = {} as Record<string, ((...args: any[]) => void)[]>;
  }

  on(event: any, listener: (...args: any[]) => void) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
  }
  emit(event: any, data: any): void {
    if (this.events[event]) this.events[event].forEach((l) => l(data));
  }
}

export class XftpServerAddress {
  readonly address: string;
  readonly url: URL;

  private constructor(url: URL) {
    this.url = url;
    this.address = decodeURIComponent(url.toString());
  }

  public static create(address: string): XftpServerAddress {
    const url = new URL(address);
    if (!XftpServerAddress.isValidAddress(url)) {
      throw new Error("Invalid address");
    }
    return new XftpServerAddress(url);
  }

  private static isValidAddress(url: URL): boolean {
    try {
      return url.protocol === "xftp:" && url.username.length > 0 && url.host.length > 0 && url.pathname.length == 0;
    } catch {
      return false;
    }
  }
}

export type Status = boolean | "checking";
export interface XftpFileAddress {
  server: XftpServerAddress;
  path: string;
}

export interface XftpServer {
  server: XftpServerAddress;
  enabled: boolean;
  status: Status;
  isCommunity?: boolean;
}

export type FileDescriptor = string;

export interface ProgressStatus {
  min: number;
  max: number;
  current: number;
}

export interface FileChunkStatus {
  server: XftpServerAddress;
  progress: ProgressStatus;
}

export type FileTransferStatus = FileChunkStatus[];

export interface FileProgress<T extends File | FileDescriptor> {
  promise: Promise<T>;
  events: EventEmitter<FileTransferStatus>;
}

export interface PrimaryDownloadPlan {
  address: XftpFileAddress;
  _fd?: any;
}

export interface FinalDownloadPlan {
  size?: number;
  addresses: XftpFileAddress[];
  filename: string;
  _resolvedFd?: any;
}
