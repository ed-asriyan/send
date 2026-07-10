# Send — Copilot / AI Instructions
Read this fully before generating any code. It explains the project architecture, styling boundaries, and strict rules for where code belongs. Do not invent new layers, do not mix business logic into UI, and strictly follow the "Gemini-style" design language.

## 1. What this project is
A browser-based client for distributing (uploading) and retrieving (downloading) encrypted files via SimpleX Chat's XFTP network. It chunks files, encrypts them locally, and routes them through multiple independent XFTP servers.

The application is heavily compartmentalized. It consists of two entirely separate workspaces:
- `lib/` (Core Domain): The pure business logic, network orchestration, and cryptography. It knows **nothing** about the DOM, Svelte, or UI state.
- `app/` (Frontend): A Vite + Svelte 5 application. It acts purely as a presentation layer and drives the ports exposed by `lib/`.

## 2. Architecture & Hard Boundaries
We use a strict Ports and Adapters (Hexagonal) mindset.
- **NEVER** write business logic inside `.svelte` files.
- **NEVER** import UI frameworks, DOM types (`HTMLElement`, `window`), or CSS into the `lib/` workspace.
- The UI (`app/`) communicates with `lib/` by instantiating the core application (e.g., `XftpSendApp`) and calling its methods, responding to `EventEmitter` events for progress updates.

### Where do I put new code? (Decision Table)
| You are adding… | Put it in… |
|-----------------|------------|
| Core XFTP routing, chunking, or encryption logic | `lib/src/` |
| A new interface/port for the domain | `lib/src/ports.ts` |
| A new UI screen / major state | `app/src/views/<Name>View.svelte` |
| A reusable visual element (button, input, progress bar) | `app/src/components/<Name>.svelte` |
| Hardcoded text, labels, or UI copy | `app/src/locales/en.json` (and other languages) |
| Global UI state orchestration (routing between views) | `app/src/App.svelte` or a dedicated state module |

## 3. UI / UX Rules ("Gemini Style" & Extreme Minimalism)
The frontend relies on a specific "Glassmorphic" minimal aesthetic. **Do not engage in unstructured "vibe coding" or improvise new UI layouts.** Stick strictly to the established skeleton and these visual constraints:

- **Single Point of Focus:** Every view must have exactly ONE primary visual focal point (e.g., the dropzone, the progress animation, or the main action button). Do not split the user's attention.
- **Aggressive Decluttering:** Do not add helper texts, borders, dividers, or icons unless explicitly requested. Use negative space (margins/padding) to separate elements, not lines or boxes.
- **No sharp borders or raw lines:** Use heavy rounded corners (`rounded-2xl`, `rounded-full`, `rounded-[2rem]`).
- **Glassmorphism Restraint:** Use `bg-white/40`, `backdrop-blur-xl`, and soft shadows (`shadow-[0_8px_32px_rgba(0,0,0,0.04)]`) for main containers. Do not stack multiple glassmorphic elements on top of each other.
- **Fluidity:** Use `transition-all duration-300` on interactable elements. Backgrounds should have soft, slow-moving animated gradients (ambient blobs).
- **Color Discipline:** Stick exclusively to the established Tailwind palette (`slate` for text, `indigo`/`purple` for primary accents, `emerald`/`red` for status). Do not invent new color schemes.
- **No Native Browser Elements:** Never use default `<select>`, `<input type="file">` (hide it and trigger via custom buttons), or native scrollbars.
- **SVGs over Images:** Use inline SVGs with `currentColor` or soft Tailwind stroke colors for iconography.

## 4. Internationalization (i18n) Protocol
We use `svelte-i18n`. **Never hardcode user-facing strings in HTML or TypeScript.**
1. All UI strings live in `app/src/locales/en.json`.
2. Keep the JSON structure flat or grouped strictly by view (e.g., `{"uploadView": {"title": "Drop file"}}`).
3. In Svelte components, import the translate store (`import { t } from 'svelte-i18n'`) and render strings as `{$t('key')}`.
4. If you add a new text element, you **must** update `en.json` first.

## 5. State Management
- Use Svelte Runes (`$state`, `$derived`, `$effect`) for local and global reactivity.
- Keep components dumb. Pass data down via props and emit events up, or read from a centralized `$state` object for the global routing step (Upload -> Progress -> Result).

## 6. Common Task: Adding a new UI View
1. Create `app/src/views/NewView.svelte`.
2. Add necessary translation keys to `app/src/locales/en.json`.
3. Apply Gemini-style classes (glass, large radius, soft text colors).
4. Register the view in `App.svelte`'s state machine (update the active view logic).
5. If it requires core data, pass the `XftpSendApp` instance as a prop or context; do not recreate it.

## 7. Core Domain Logic: XFTP & The File Transfer Lifecycle
Copilot, you MUST understand how the underlying SimpleX XFTP network and our chunking mechanism work to write correct business logic in `lib/`. Do not violate these principles.

### The Trustless Philosophy
We use XFTP relays. These are blind, decentralized nodes. We do not trust them. They never see whole files, and they never see decryption keys. The routing is decentralized, and keys are exchanged entirely Out-Of-Band (OOB) via the URL fragment (`#`).

### The Upload Flow (Sharding & Encryption)
1. **Node Selection:** The application polls user-configured XFTP servers to build a pool of active, reachable nodes.
2. **Chunking & Encryption:** The target file is split into smaller chunks. Each chunk is encrypted locally in the browser (e.g., using AES-GCM or NaCl).
3. **Randomized Distribution:** Encrypted chunks are dispatched in parallel across a randomized subset of the active XFTP servers. No single server operators receive enough data to reconstruct the file.
4. **The Metadata Map:** Once all chunks are uploaded, a "Map File" (or Metadata Manifest) is compiled. This file contains:
   - The original filename, MIME type, and total size.
   - The topology: which chunk lives on which XFTP server.
   - The cryptographic keys and nonces required to decrypt each specific chunk.
5. **Map Upload & Descriptor Generation:** This Map File is itself encrypted and uploaded to a primary XFTP registry node. The address of this node and the decryption key for the Map File are encoded into a string (the "Descriptor").
6. **Out-of-Band Link:** The Descriptor is injected into the URL hash (`https://.../#<descriptor>`). The browser NEVER sends the hash to the host server, ensuring Zero-Knowledge at the transport layer.

### The Download Flow (Reassembly)
1. **Hash Parsing:** The app extracts the Descriptor from the URL hash.
2. **Phase 1 (Primary Plan):** The app connects to the primary registry node, fetches the encrypted Map File, and decrypts it using the OOB key from the Descriptor.
3. **Phase 2 (Final Plan):** The app parses the decrypted Map File to discover the chunk topology and decryption keys.
4. **Parallel Retrieval:** The app streams the encrypted chunks from the decentralized XFTP servers concurrently.
5. **On-the-fly Reassembly:** Chunks are decrypted in memory, verified, ordered, and reconstructed into a single `Blob` for the user to download.

**Strict Rule for Copilot:** When implementing cryptographic or networking features in `lib/`, strictly follow this decentralized flow. Do not implement central server logic, and never expose decryption keys outside of the client's memory or the URL hash.

## 8. User Scenarios (User Journeys)
To help contextualize the UI states, keep these primary user journeys in mind:

### Scenario A: Sending a File (Sender)
1. **Initial State:** User opens the application and sees `UploadView` containing a dropzone.
2. **Action:** User selects or dragged-and-drops a file.
3. **Processing:** The app transitions to `ProgressView`. The user sees a smooth glassmorphic progress bar and network graph (`NetworkGraph.svelte`) while chunks are encrypted and uploaded in the background.
4. **Success:** App transitions to `ResultView`. A unique hash URL with the encrypted Map File descriptor is generated. The user can copy this link or generate a QR code to share out-of-band.

### Scenario B: Receiving a File (Receiver)
1. **Initial State:** User opens the application using a URL containing a hash (e.g., `https://.../#<descriptor>`).
2. **Action:** The app detects the hash, mounts, and immediately begins fetching the Map File (Metadata) from the primary node. User sees a loading state.
3. **Confirmation:** The app decrypts the Map File and transitions to `ConfirmView`, showing the filename and size. The user is prompted to start the download.
4. **Downloading:** Upon approval, app transitions to `ProgressView` (download mode). Chunks are streamed, decrypted, and reassembled.
5. **Success:** App transitions to `CompleteView` and triggers the browser's native file save dialog via a reconstructed Blob.

### Scenario C: Unhappy Paths & Edge Cases
- **No Servers:** If the initial XFTP node poll fails, show `NoServersView`. Do not allow file selection.
- **Network Drop:** If a transfer fails mid-way, the UI should gracefully show an error state within `ProgressView` with a retry option, rather than crashing to a raw browser error.
- **Invalid Link:** If a receiver opens a malformed URL hash, show a friendly error rather than a blank screen.