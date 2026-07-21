// XFTP upload/download orchestration + URI encoding -- Simplex.FileTransfer.Client.Main
//
// Combines all building blocks: encryption, chunking, XFTP client commands,
// file descriptions, and DEFLATE-compressed URI encoding.

import {encryptFile, encodeFileHeader} from "./crypto/file.js"
import {generateEd25519KeyPair, encodePubKeyEd25519, encodePrivKeyEd25519, decodePrivKeyEd25519, ed25519KeyPairFromSeed} from "./crypto/keys.js"
import {sha512Streaming} from "./crypto/digest.js"
import {prepareChunkSizes, prepareChunkSpecs, getChunkDigest, fileSizeLen, authTagSize} from "./protocol/chunks.js"
import {
  encodeFileDescription, decodeFileDescription, validateFileDescription,
  base64urlEncode, base64urlDecode,
  type FileDescription, type FileParty, type FileChunk, type RedirectFileInfo
} from "./protocol/description.js"
import type {FileInfo} from "./protocol/commands.js"
import {
  createXFTPChunk, uploadXFTPChunk, downloadXFTPChunk, downloadXFTPChunkRaw,
  deleteXFTPChunk, type XFTPClientAgent
} from "./client.js"
export {newXFTPAgent, closeXFTPAgent, type XFTPClientAgent, type TransportConfig} from "./client.js"
import {processDownloadedFile, decryptReceivedChunk} from "./download.js"
import type {XFTPServer} from "./protocol/address.js"
import {formatXFTPServer, parseXFTPServer} from "./protocol/address.js"
import type {FileHeader} from "./crypto/file.js"

class ServerPool {
  private available: Set<XFTPServer>;
  private waiters: ((s: XFTPServer) => void)[] = [];

  constructor(servers: XFTPServer[]) {
    this.available = new Set(servers);
  }

  acquire(): Promise<XFTPServer> {
    if (this.available.size > 0) {
      const items = Array.from(this.available);
      const idx = Math.floor(Math.random() * items.length);
      const srv = items[idx];
      this.available.delete(srv);
      return Promise.resolve(srv);
    }
    return new Promise(resolve => this.waiters.push(resolve));
  }

  release(server: XFTPServer) {
    if (this.waiters.length > 0) {
      const resolve = this.waiters.shift()!;
      resolve(server);
    } else {
      this.available.add(server);
    }
  }
}

// -- Types

interface SentChunk {
  chunkNo: number
  senderId: Uint8Array
  senderKey: Uint8Array      // 64B libsodium Ed25519 private key
  recipientId: Uint8Array
  recipientKey: Uint8Array   // 64B libsodium Ed25519 private key
  chunkSize: number
  digest: Uint8Array         // SHA-256
  server: XFTPServer
}

export interface EncryptedFileMetadata {
  digest: Uint8Array          // SHA-512 of encData
  key: Uint8Array             // 32B SbKey
  nonce: Uint8Array           // 24B CbNonce
  chunkSizes: number[]
}

export interface EncryptedFileInfo extends EncryptedFileMetadata {
  encData: Uint8Array
}

export interface UploadResult {
  rcvDescription: FileDescription
  sndDescription: FileDescription
  uri: string                 // base64url-encoded compressed YAML (no leading #)
}

export interface DownloadResult {
  header: FileHeader
  content: Uint8Array
}

// -- URI encoding/decoding (compact binary + base64url)
//
// App-internal format for the URL hash. Replaces the previous
// "YAML -> DEFLATE -> base64url" scheme, which double-encoded every
// cryptographic field as base64 text before compressing. This binary
// layout stores raw bytes once and drops fully-derivable data:
//   * chunkNo         -> reconstructed as (index + 1)
//   * replica count   -> always 1 (asserted on encode)
//   * per-chunk size   -> stored only when it differs from the default
//   * private keys      -> raw 32-byte Ed25519 seed instead of 48-byte DER
//   * server addresses  -> deduplicated into a table, referenced by index
//
// Not interchangeable with standard SimpleX YAML descriptors. The redirect
// file payload still uses the YAML encoder (see uploadRedirectDescription).

const URI_FORMAT_VERSION = 1
const FLAG_PARTY_SENDER = 1
const FLAG_HAS_REDIRECT = 2

class ByteWriter {
  private buf: number[] = []
  u8(n: number): void { this.buf.push(n & 0xff) }
  varint(n: number): void {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error("varint: invalid value " + n)
    while (n > 0x7f) {
      this.buf.push((n % 128) | 0x80)
      n = Math.floor(n / 128)
    }
    this.buf.push(n)
  }
  bytes(b: Uint8Array): void { for (let i = 0; i < b.length; i++) this.buf.push(b[i]) }
  lenBytes(b: Uint8Array): void { this.varint(b.length); this.bytes(b) }
  lenStr(s: string): void { this.lenBytes(new TextEncoder().encode(s)) }
  toUint8Array(): Uint8Array { return new Uint8Array(this.buf) }
}

class ByteReader {
  private pos = 0
  constructor(private data: Uint8Array) {}
  u8(): number {
    if (this.pos >= this.data.length) throw new Error("ByteReader: unexpected end of data")
    return this.data[this.pos++]
  }
  varint(): number {
    let result = 0, mul = 1, b: number
    do {
      b = this.u8()
      result += (b & 0x7f) * mul
      mul *= 128
      if (mul > Number.MAX_SAFE_INTEGER) throw new Error("varint: value too large")
    } while (b & 0x80)
    return result
  }
  bytes(n: number): Uint8Array {
    if (this.pos + n > this.data.length) throw new Error("ByteReader: unexpected end of data")
    const out = this.data.slice(this.pos, this.pos + n)
    this.pos += n
    return out
  }
  lenBytes(): Uint8Array { return this.bytes(this.varint()) }
  lenStr(): string { return new TextDecoder().decode(this.lenBytes()) }
}

export function encodeDescriptionURI(fd: FileDescription): string {
  if (fd.digest.length !== 64) throw new Error("encodeDescriptionURI: file digest must be 64 bytes")
  if (fd.key.length !== 32) throw new Error("encodeDescriptionURI: key must be 32 bytes")
  if (fd.nonce.length !== 24) throw new Error("encodeDescriptionURI: nonce must be 24 bytes")

  const w = new ByteWriter()
  w.u8(URI_FORMAT_VERSION)
  let flags = 0
  if (fd.party === "sender") flags |= FLAG_PARTY_SENDER
  if (fd.redirect !== null) flags |= FLAG_HAS_REDIRECT
  w.u8(flags)
  w.varint(fd.size)
  w.varint(fd.chunkSize)
  w.bytes(fd.digest)
  w.bytes(fd.key)
  w.bytes(fd.nonce)
  if (fd.redirect !== null) {
    if (fd.redirect.digest.length !== 64) throw new Error("encodeDescriptionURI: redirect digest must be 64 bytes")
    w.varint(fd.redirect.size)
    w.bytes(fd.redirect.digest)
  }

  // Deduplicate server addresses into a table referenced by index.
  const serverIndex = new Map<string, number>()
  const servers: string[] = []
  for (const c of fd.chunks) {
    for (const r of c.replicas) {
      if (!serverIndex.has(r.server)) {
        serverIndex.set(r.server, servers.length)
        servers.push(r.server)
      }
    }
  }
  w.varint(servers.length)
  for (const s of servers) {
    const srv = parseXFTPServer(s)
    if (srv.keyHash.length !== 32) throw new Error("encodeDescriptionURI: server keyHash must be 32 bytes")
    w.bytes(srv.keyHash)
    w.lenStr(srv.host)
    w.lenStr(srv.port)
  }

  w.varint(fd.chunks.length)
  for (let i = 0; i < fd.chunks.length; i++) {
    const c = fd.chunks[i]
    if (c.chunkNo !== i + 1) throw new Error("encodeDescriptionURI: chunk numbers are not sequential")
    if (c.replicas.length !== 1) throw new Error("encodeDescriptionURI: expected exactly one replica per chunk")
    if (c.digest.length !== 32) throw new Error("encodeDescriptionURI: chunk digest must be 32 bytes")
    const r = c.replicas[0]
    w.varint(serverIndex.get(r.server)!)
    w.varint(c.chunkSize === fd.chunkSize ? 0 : c.chunkSize)
    w.bytes(c.digest)
    w.lenBytes(r.replicaId)
    w.bytes(decodePrivKeyEd25519(r.replicaKey)) // 32-byte Ed25519 seed
  }

  // Strip '=' padding: base64urlDecode tolerates its absence and it only adds
  // visual noise to the URL. Keeps the fragment as clean [A-Za-z0-9-_].
  return base64urlEncode(w.toUint8Array()).replace(/=+$/, "")
}

export function decodeDescriptionURI(fragment: string): FileDescription {
  const r = new ByteReader(base64urlDecode(fragment))
  const version = r.u8()
  if (version !== URI_FORMAT_VERSION) throw new Error("decodeDescriptionURI: unsupported format version " + version)
  const flags = r.u8()
  const party: FileParty = (flags & FLAG_PARTY_SENDER) ? "sender" : "recipient"
  const hasRedirect = (flags & FLAG_HAS_REDIRECT) !== 0
  const size = r.varint()
  const chunkSize = r.varint()
  const digest = r.bytes(64)
  const key = r.bytes(32)
  const nonce = r.bytes(24)
  let redirect: RedirectFileInfo | null = null
  if (hasRedirect) {
    const rSize = r.varint()
    const rDigest = r.bytes(64)
    redirect = {size: rSize, digest: rDigest}
  }

  const serverCount = r.varint()
  const servers: string[] = []
  for (let i = 0; i < serverCount; i++) {
    const keyHash = r.bytes(32)
    const host = r.lenStr()
    const port = r.lenStr()
    servers.push(formatXFTPServer({keyHash, host, port}))
  }

  const chunkCount = r.varint()
  const chunks: FileChunk[] = []
  for (let i = 0; i < chunkCount; i++) {
    const serverIdx = r.varint()
    if (serverIdx >= servers.length) throw new Error("decodeDescriptionURI: server index out of range")
    const rawChunkSize = r.varint()
    const chunkDigest = r.bytes(32)
    const replicaId = r.lenBytes()
    const seed = r.bytes(32)
    chunks.push({
      chunkNo: i + 1,
      chunkSize: rawChunkSize === 0 ? chunkSize : rawChunkSize,
      digest: chunkDigest,
      replicas: [{
        server: servers[serverIdx],
        replicaId,
        replicaKey: encodePrivKeyEd25519(seed) // rebuild 48-byte DER
      }]
    })
  }

  const fd: FileDescription = {party, size, digest, key, nonce, chunkSize, chunks, redirect}
  const err = validateFileDescription(fd)
  if (err) throw new Error("decodeDescriptionURI: " + err)
  return fd
}

// -- Upload

export function encryptFileForUpload(source: Uint8Array, fileName: string): EncryptedFileInfo {
  const key = new Uint8Array(32)
  const nonce = new Uint8Array(24)
  crypto.getRandomValues(key)
  crypto.getRandomValues(nonce)
  const fileHdr = encodeFileHeader({fileName, fileExtra: null})
  const fileSize = BigInt(fileHdr.length + source.length)
  const payloadSize = Number(fileSize) + fileSizeLen + authTagSize
  const chunkSizes = prepareChunkSizes(payloadSize)
  const encSize = BigInt(chunkSizes.reduce((a, b) => a + b, 0))
  const encData = encryptFile(source, fileHdr, key, nonce, fileSize, encSize)
  const digest = sha512Streaming([encData])
  console.log(`[AGENT-DBG] encrypt: encData.len=${encData.length} digest=${_dbgHex(digest, 64)} chunkSizes=[${chunkSizes.join(',')}]`)
  return {encData, digest, key, nonce, chunkSizes}
}

const DEFAULT_REDIRECT_THRESHOLD = 400

export interface ServerProgress {
  uploaded: number
  total: number
}

export interface UploadOptions {
  onProgress?: (uploaded: number, total: number, perServer?: Map<string, ServerProgress>) => void
  redirectThreshold?: number
  readChunk?: (offset: number, size: number) => Promise<Uint8Array>
  maxSweeps?: number
}

export async function uploadFile(
  agent: XFTPClientAgent,
  servers: XFTPServer[],
  encrypted: EncryptedFileMetadata,
  options?: UploadOptions
): Promise<UploadResult> {
  if (servers.length === 0) throw new Error("uploadFile: servers list is empty")
  const {onProgress, redirectThreshold, readChunk: readChunkOpt, maxSweeps} = options ?? {}
  const maxAttempts = servers.length * (maxSweeps ?? 2)

  const readChunk: (offset: number, size: number) => Promise<Uint8Array> = readChunkOpt
    ? readChunkOpt
    : ('encData' in encrypted
        ? (off, sz) => Promise.resolve((encrypted as EncryptedFileInfo).encData.subarray(off, off + sz))
        : () => { throw new Error("uploadFile: readChunk required when encData is absent") })
  const total = encrypted.chunkSizes.reduce((a, b) => a + b, 0)
  const specs = prepareChunkSpecs(encrypted.chunkSizes)

  const pool = new ServerPool(servers)
  const perServerMap = new Map<string, ServerProgress>()
  for (const s of servers) {
    perServerMap.set(formatXFTPServer(s), { uploaded: 0, total: 0 })
  }

  // Pre-estimate totals for UI (assume roughly even distribution)
  for (let i = 0; i < specs.length; i++) {
    const srv = servers[i % servers.length]
    perServerMap.get(formatXFTPServer(srv))!.total += specs[i].chunkSize
  }

  const jobs = specs.map((spec, i) => ({ index: i, spec }))
  const sentChunks: SentChunk[] = new Array(specs.length)
  let uploaded = 0
  onProgress?.(0, total, perServerMap)
  
  const workers = servers.map(async () => {
    while (true) {
      const job = jobs.shift()
      if (!job) break // no more jobs

      let attempts = 0
      let success = false
      while (!success) {
        attempts++
        const currentServer = await pool.acquire()
        const key = formatXFTPServer(currentServer)
        
        try {
          const {index, spec} = job
          const chunkNo = index + 1
          const sndKp = generateEd25519KeyPair()
          const rcvKp = generateEd25519KeyPair()
          const chunkData = await readChunk(spec.chunkOffset, spec.chunkSize)
          const chunkDigest = getChunkDigest(chunkData)
          const fileInfo: FileInfo = {
            sndKey: encodePubKeyEd25519(sndKp.publicKey),
            size: spec.chunkSize,
            digest: chunkDigest
          }
          const rcvKeysForChunk = [encodePubKeyEd25519(rcvKp.publicKey)]
          const {senderId, recipientIds} = await createXFTPChunk(
            agent, currentServer, sndKp.privateKey, fileInfo, rcvKeysForChunk
          )
          await uploadXFTPChunk(agent, currentServer, sndKp.privateKey, senderId, chunkData)
          
          sentChunks[index] = {
            chunkNo, senderId, senderKey: sndKp.privateKey,
            recipientId: recipientIds[0], recipientKey: rcvKp.privateKey,
            chunkSize: spec.chunkSize, digest: chunkDigest, server: currentServer
          }
          uploaded += spec.chunkSize
          const stats = perServerMap.get(key)
          if (stats) stats.uploaded += spec.chunkSize
          onProgress?.(uploaded, total, perServerMap)
          
          success = true
        } catch (err) {
          if (attempts >= maxAttempts) {
            throw err
          }
        } finally {
          pool.release(currentServer)
        }
      }
    }
  })

  await Promise.all(workers)

  const rcvDescription = buildDescription("recipient", encrypted, sentChunks)
  const sndDescription = buildDescription("sender", encrypted, sentChunks)
  let uri = encodeDescriptionURI(rcvDescription)
  let finalRcvDescription = rcvDescription
  const threshold = redirectThreshold ?? DEFAULT_REDIRECT_THRESHOLD
  if (uri.length > threshold && sentChunks.length > 1) {
    finalRcvDescription = await uploadRedirectDescription(agent, servers, rcvDescription)
    uri = encodeDescriptionURI(finalRcvDescription)
  }
  return {rcvDescription: finalRcvDescription, sndDescription, uri}
}

function buildDescription(
  party: "recipient" | "sender",
  enc: EncryptedFileMetadata,
  chunks: SentChunk[]
): FileDescription {
  const defChunkSize = enc.chunkSizes[0]
  return {
    party,
    size: enc.chunkSizes.reduce((a, b) => a + b, 0),
    digest: enc.digest,
    key: enc.key,
    nonce: enc.nonce,
    chunkSize: defChunkSize,
    chunks: chunks.map(c => ({
      chunkNo: c.chunkNo,
      chunkSize: c.chunkSize,
      digest: c.digest,
      replicas: [{
        server: formatXFTPServer(c.server),
        replicaId: party === "recipient" ? c.recipientId : c.senderId,
        replicaKey: encodePrivKeyEd25519(party === "recipient" ? c.recipientKey : c.senderKey)
      }]
    })),
    redirect: null
  }
}

async function uploadRedirectDescription(
  agent: XFTPClientAgent,
  servers: XFTPServer[],
  innerFd: FileDescription
): Promise<FileDescription> {
  const yaml = encodeFileDescription(innerFd)
  const yamlBytes = new TextEncoder().encode(yaml)
  const enc = encryptFileForUpload(yamlBytes, "")
  const specs = prepareChunkSpecs(enc.chunkSizes)

  // Upload every redirect chunk to a SINGLE server, so the resulting URL
  // references just one server address (shorter link). Try servers in random
  // order; if a server fails mid-upload, discard the partial upload and retry
  // the whole metafile on the next server. Fails only if every server fails.
  const candidates = servers.slice()
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  let lastErr: unknown = null
  for (const server of candidates) {
    try {
      const sentChunks: SentChunk[] = []
      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i]
        const chunkNo = i + 1
        const sndKp = generateEd25519KeyPair()
        const rcvKp = generateEd25519KeyPair()
        const chunkData = enc.encData.subarray(spec.chunkOffset, spec.chunkOffset + spec.chunkSize)
        const chunkDigest = getChunkDigest(chunkData)
        const fileInfo: FileInfo = {
          sndKey: encodePubKeyEd25519(sndKp.publicKey),
          size: spec.chunkSize,
          digest: chunkDigest
        }
        const rcvKeysForChunk = [encodePubKeyEd25519(rcvKp.publicKey)]
        const {senderId, recipientIds} = await createXFTPChunk(
          agent, server, sndKp.privateKey, fileInfo, rcvKeysForChunk
        )
        await uploadXFTPChunk(agent, server, sndKp.privateKey, senderId, chunkData)
        sentChunks.push({
          chunkNo, senderId, senderKey: sndKp.privateKey,
          recipientId: recipientIds[0], recipientKey: rcvKp.privateKey,
          chunkSize: spec.chunkSize, digest: chunkDigest, server
        })
      }
      return {
        party: "recipient",
        size: enc.chunkSizes.reduce((a, b) => a + b, 0),
        digest: enc.digest,
        key: enc.key,
        nonce: enc.nonce,
        chunkSize: enc.chunkSizes[0],
        chunks: sentChunks.map(c => ({
          chunkNo: c.chunkNo,
          chunkSize: c.chunkSize,
          digest: c.digest,
          replicas: [{
            server: formatXFTPServer(c.server),
            replicaId: c.recipientId,
            replicaKey: encodePrivKeyEd25519(c.recipientKey)
          }]
        })),
        redirect: {size: innerFd.size, digest: innerFd.digest}
      }
    } catch (err) {
      lastErr = err
      // Server failed mid-upload; discard partial upload and try the next one.
    }
  }
  throw new Error(
    "uploadRedirectDescription: all servers failed" +
    (lastErr instanceof Error ? ": " + lastErr.message : "")
  )
}

// -- Download

export interface RawDownloadedChunk {
  chunkNo: number
  dhSecret: Uint8Array
  nonce: Uint8Array
  body: Uint8Array
  digest: Uint8Array
}

export interface DownloadRawOptions {
  onProgress?: (downloaded: number, total: number, perServer?: Map<string, ServerProgress>) => void
  concurrency?: number
}

export async function downloadFileRaw(
  agent: XFTPClientAgent,
  fd: FileDescription,
  onRawChunk: (chunk: RawDownloadedChunk) => Promise<void>,
  options?: DownloadRawOptions
): Promise<FileDescription> {
  const err = validateFileDescription(fd)
  if (err) throw new Error("downloadFileRaw: " + err)
  const {onProgress, concurrency = 1} = options ?? {}
  // Resolve redirect on main thread (redirect data is small)
  if (fd.redirect !== null) {
    console.log(`[AGENT-DBG] resolving redirect: outer size=${fd.size} chunks=${fd.chunks.length}`)
    fd = await resolveRedirect(agent, fd)
    console.log(`[AGENT-DBG] resolved: size=${fd.size} chunks=${fd.chunks.length} digest=${Array.from(fd.digest.slice(0, 16)).map(x => x.toString(16).padStart(2, '0')).join('')}…`)
  }
  const resolvedFd = fd
  // Group chunks by server, sequential within each server, parallel across servers
  let downloaded = 0
  const byServer = new Map<string, typeof resolvedFd.chunks>()
  const perServerMap = new Map<string, ServerProgress>()

  for (const chunk of resolvedFd.chunks) {
    const srv = chunk.replicas[0]?.server ?? ""
    if (!byServer.has(srv)) byServer.set(srv, [])
    byServer.get(srv)!.push(chunk)

    if (!perServerMap.has(srv)) {
      perServerMap.set(srv, { uploaded: 0, total: 0 })
    }
    perServerMap.get(srv)!.total += chunk.chunkSize
  }

  onProgress?.(0, resolvedFd.size, perServerMap)

  await Promise.all([...byServer.entries()].map(async ([srv, chunks]) => {
    const server = parseXFTPServer(srv)
    for (const chunk of chunks) {
      const replica = chunk.replicas[0]
      if (!replica) throw new Error("downloadFileRaw: chunk has no replicas")
      const seed = decodePrivKeyEd25519(replica.replicaKey)
      const kp = ed25519KeyPairFromSeed(seed)
      const raw = await downloadXFTPChunkRaw(agent, server, kp.privateKey, replica.replicaId)
      console.log(`[AGENT-DBG] chunk=${chunk.chunkNo} body.len=${raw.body.length} expectedChunkSize=${chunk.chunkSize} digest=${_dbgHex(chunk.digest, 32)} body.byteOffset=${raw.body.byteOffset} body.buffer.byteLength=${raw.body.buffer.byteLength}`)
      await onRawChunk({
        chunkNo: chunk.chunkNo,
        dhSecret: raw.dhSecret,
        nonce: raw.nonce,
        body: raw.body,
        digest: chunk.digest
      })
      downloaded += chunk.chunkSize
      const stats = perServerMap.get(srv)
      if (stats) stats.uploaded += chunk.chunkSize
      onProgress?.(downloaded, resolvedFd.size, perServerMap)
    }
  }))
  return resolvedFd
}

export async function downloadFile(
  agent: XFTPClientAgent,
  fd: FileDescription,
  onProgress?: (downloaded: number, total: number, perServer?: Map<string, ServerProgress>) => void
): Promise<DownloadResult> {
  const chunks: Uint8Array[] = []
  const resolvedFd = await downloadFileRaw(agent, fd, async (raw) => {
    chunks[raw.chunkNo - 1] = decryptReceivedChunk(
      raw.dhSecret, raw.nonce, raw.body, raw.digest
    )
  }, {onProgress})
  const totalSize = chunks.reduce((s, c) => s + c.length, 0)
  if (totalSize !== resolvedFd.size) throw new Error("downloadFile: file size mismatch")
  const digest = sha512Streaming(chunks)
  if (!digestEqual(digest, resolvedFd.digest)) throw new Error("downloadFile: file digest mismatch")
  return processDownloadedFile(resolvedFd, chunks)
}

export async function resolveRedirect(
  agent: XFTPClientAgent,
  fd: FileDescription
): Promise<FileDescription> {
  const plaintextChunks: Uint8Array[] = new Array(fd.chunks.length)
  for (const chunk of fd.chunks) {
    const replica = chunk.replicas[0]
    if (!replica) throw new Error("resolveRedirect: chunk has no replicas")
    const server = parseXFTPServer(replica.server)
    const seed = decodePrivKeyEd25519(replica.replicaKey)
    const kp = ed25519KeyPairFromSeed(seed)
    const data = await downloadXFTPChunk(agent, server, kp.privateKey, replica.replicaId, chunk.digest)
    plaintextChunks[chunk.chunkNo - 1] = data
  }
  const totalSize = plaintextChunks.reduce((s, c) => s + c.length, 0)
  if (totalSize !== fd.size) throw new Error("resolveRedirect: redirect file size mismatch")
  const digest = sha512Streaming(plaintextChunks)
  if (!digestEqual(digest, fd.digest)) throw new Error("resolveRedirect: redirect file digest mismatch")
  const {content: yamlBytes} = processDownloadedFile(fd, plaintextChunks)
  const yamlStr = new TextDecoder().decode(yamlBytes)
  const innerFd = decodeFileDescription(yamlStr)
  const innerErr = validateFileDescription(innerFd)
  if (innerErr) throw new Error("resolveRedirect: inner description invalid: " + innerErr)
  if (innerFd.size !== fd.redirect!.size) throw new Error("resolveRedirect: redirect size mismatch")
  if (!digestEqual(innerFd.digest, fd.redirect!.digest)) throw new Error("resolveRedirect: redirect digest mismatch")
  return innerFd
}

// -- Delete

export async function deleteFile(agent: XFTPClientAgent, sndDescription: FileDescription): Promise<void> {
  for (const chunk of sndDescription.chunks) {
    const replica = chunk.replicas[0]
    if (!replica) throw new Error("deleteFile: chunk has no replicas")
    const server = parseXFTPServer(replica.server)
    const seed = decodePrivKeyEd25519(replica.replicaKey)
    const kp = ed25519KeyPairFromSeed(seed)
    await deleteXFTPChunk(agent, server, kp.privateKey, replica.replicaId)
  }
}

// -- Internal

function _dbgHex(b: Uint8Array, n = 8): string {
  return Array.from(b.slice(0, n)).map(x => x.toString(16).padStart(2, '0')).join('')
}

function digestEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
