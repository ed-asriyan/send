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

  private constructor(address: string) {
    this.address = address;
  }

  public static create(address: string): XftpServerAddress {
    if (!XftpServerAddress.isValidAddress(address)) {
      throw new Error("Invalid address");
    }
    return new XftpServerAddress(address);
  }

  public getDomain(): string {
    return this.address.split('@')[1];
  }

  private static isValidAddress(address: string): boolean {
    // todo
    return true;
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
}

export interface FinalDownloadPlan {
  addresses: XftpFileAddress[];
  filename: string;
}
