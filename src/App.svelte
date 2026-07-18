<script lang="ts">
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut, cubicIn } from "svelte/easing";
  import { _ } from "./lib/i18n";
  import { trackEvent } from "./lib/tracking";
  import {
    XftpSendApp as XftpSend,
    CommunityServersManager,
  } from "./lib/index";
  import { XftpServerAddress } from "./lib/models";
  import type {
    FileTransferStatus,
    FinalDownloadPlan,
    XftpServer,
  } from "./lib/models";
  import AmbientBackground from "./components/AmbientBackground.svelte";
  import Header from "./components/Header.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import UploadView from "./views/UploadView.svelte";
  import NoServersView from "./views/NoServersView.svelte";
  import ProgressView from "./views/ProgressView.svelte";
  import ResultView from "./views/ResultView.svelte";
  import ConfirmView from "./views/ConfirmView.svelte";
  import CompleteView from "./views/CompleteView.svelte";
  import AboutOverlay from "./components/AboutOverlay.svelte";
  import { get } from "svelte/store";

  type ViewType = "upload" | "progress" | "result" | "confirm" | "complete";

  const isSharedRoute =
    typeof window !== "undefined" && window.location.search.includes("shared=");

  function hasNonEmptyHash() {
    return typeof window !== "undefined" && window.location.hash.length > 1;
  }

  // State (Svelte 5 Runes)
  let currentView = $state<ViewType>("progress");
  let isSidebarOpen = $state(false);
  let showAbout = $state(false);

  let isDownloadMode = $state(false);
  let app = $state<XftpSend>(new XftpSend());
  let community = $state<CommunityServersManager>(
    new CommunityServersManager(app),
  );
  let servers = $state<XftpServer[]>([]);

  let hasAvailableServers = $derived(
    servers.some(
(s) => s.enabled && (s.status === true || s.status === "checking"),
),
  );

  let appAction = $state<
    "idle" | "initializing" | "uploading" | "downloading" | "preparing_share"
  >(isSharedRoute ? "preparing_share" : "initializing");
  let currentFile = $state<string | null>(null);

  let progressTitle = $derived.by(() => {
    if (appAction === "initializing") return $_("app.initializing");
    if (appAction === "downloading")
      return $_("app.downloading", {
        values: { filename: currentFile || $_("app.unknown_file") },
      });
    if (appAction === "uploading")
      return $_("app.uploading", {
        values: { filename: currentFile || $_("app.unknown_file") },
      });
    if (appAction === "preparing_share")
      return $_("app.preparing_share", {
        values: { filename: currentFile || $_("app.unknown_file") },
      });
    return "";
  });

  let progressSubtitle = $derived.by(() => {
    if (appAction === "initializing")
      return isDownloadMode
        ? $_("app.locating_map")
        : $_("app.connecting_servers");
    if (appAction === "downloading") return $_("app.decrypting");
    if (appAction === "uploading") return $_("app.distributing");
    if (appAction === "preparing_share") return $_("app.connecting_servers");
    return "";
  });

  let fileTransferStatus = $state<FileTransferStatus>([]);

  let uploadDescriptor = $state<string>("");
  let downloadBlob = $state<Blob | null>(null);

  let confirmFileName = $state<string | null>(null);
  let confirmTitle = $derived(confirmFileName || $_("app.unknown_file"));
  let confirmDesc = $state("");
  let confirmServers = $state<string[]>([]);
  let confirmAction = $state<() => void | Promise<void>>(() => {});

  let useCommunityServers = $state<boolean>(community.isEnabled);

  async function loadServers() {
    servers = [...app.listServers()];
    useCommunityServers = community.isEnabled;
  }

  async function handleToggleCommunityServers(enabled: boolean) {
    useCommunityServers = enabled;
    await community.setEnabled(enabled);
  }

  async function handleFetchCommunity() {
    await community.refresh();
    loadServers();
  }

  function handleClearCommunity() {
    community.clear();
    loadServers();
  }

  async function checkSharedFile(initPromise: Promise<any>) {
    const url = new URL(window.location.href);
    if (url.searchParams.has("shared")) {
      appAction = "preparing_share";
      currentView = "progress";
      url.searchParams.delete("shared");
      window.history.replaceState({}, "", url);

      try {
        const file = await getSharedFile();
        if (file) {
          currentFile = file.name;

          // Ожидаем завершения параллельного пинга всех серверов
          await initPromise;

          const active = app
            .listServers()
            .filter((s) => s.enabled && s.status === true);

          if (active.length === 0) {
            alert(
              get(_)("app.upload_error", {
                values: { error: "Could not connect to any XFTP server." },
              }),
            );
            currentView = "upload";
            return;
          }

          await handleUpload(file);
        } else {
          appAction = "idle";
          currentView = "upload";
        }
      } catch (err) {
        console.error("Failed to handle shared file:", err);
        appAction = "idle";
        currentView = "upload";
      }
    }
  }

  function getSharedFile(): Promise<File | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("SimpleXSharedFiles", 1);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "id" });
        }
      };

      request.onsuccess = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("files")) {
          return resolve(null);
        }
        const tx = db.transaction("files", "readwrite");
        const store = tx.objectStore("files");
        const getReq = store.get("shared-file");

        getReq.onsuccess = () => {
          if (getReq.result) {
            store.delete("shared-file");
            resolve(getReq.result.file);
          } else {
            resolve(null);
          }
        };

        getReq.onerror = () => reject(getReq.error);
        tx.oncomplete = () => db.close();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async function initServers() {
    if (community.isEnabled) {
      await community.refresh();
    }
    loadServers();
    const checks = app.listServers().map((s) =>
      app
        .refreshStatus(s.server)
        .catch((e) => console.warn("Refresh failed for", s.server.address, e))
        .finally(() => loadServers()),
    );

    const timeout = isSharedRoute ? 3500 : 350;

    await Promise.race([
      Promise.all(checks),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeout),
      ),
    ]).catch(() => {});
  }

  onMount(() => {
    window.addEventListener("hashchange", handleHashRoute);
    const initialHash = window.location.hash;
    const openedWithHash = initialHash.length > 1;

    // Запускаем опрос всех серверов и сохраняем Promise
    const initPromise = initServers();

    if (isSharedRoute) {
      // Передаем этот Promise в checkSharedFile, чтобы загрузка ждала именно его
      checkSharedFile(initPromise);
    } else if (openedWithHash) {
      handleHashRoute();
    } else {
      initPromise.finally(() => {
        if (window.location.hash === initialHash) {
          appAction = "idle";
          currentView = "upload";
        }
      });
    }

    return () => {
      window.removeEventListener("hashchange", handleHashRoute);
    };
  });

  async function handleHashRoute() {
    const hash = window.location.hash.substring(1);
    if (!hash) {
      isDownloadMode = false;
      if (appAction !== "preparing_share") {
        currentView = "upload";
      }
      return;
    }

    isDownloadMode = true;
    appAction = "initializing";
    currentFile = null;
    fileTransferStatus = [];
    currentView = "progress";

    try {
      const mapPlan = await app.getPrimaryDownloadPlan(hash);
      const finalPlan = await app.getFinalDownloadPlan(mapPlan);

      const sizeFormatted = finalPlan.size
        ? finalPlan.size > 1024 * 1024
          ? (finalPlan.size / (1024 * 1024)).toFixed(1) + " MB"
          : (finalPlan.size / 1024).toFixed(1) + " KB"
        : "";
      showConfirmDialog(
        finalPlan.filename || null,
        sizeFormatted ? `~ ${sizeFormatted} total` : "",

        finalPlan.addresses.map((a) => a.server.url.host),
        async () => {
          await startDownload(finalPlan);
        },
      );
    } catch (e: any) {
      alert(get(_)("app.init_error", { values: { error: e.message } }));
      window.location.hash = "";
    }
  }

  function showConfirmDialog(
    filename: string | null,
    desc: string,
    srvs: string[],
    onConfirm: () => void | Promise<void>,
  ) {
    confirmFileName = filename;
    confirmDesc = desc;
    confirmServers = srvs;
    confirmAction = onConfirm;
    currentView = "confirm";
  }

  async function startDownload(finalPlan: FinalDownloadPlan) {
    appAction = "downloading";
    currentFile = finalPlan.filename || null;
    currentView = "progress";

    try {
      const { promise, events } = await app.downloadFile(finalPlan);
      events.on("progress", (statusMap) => {
        fileTransferStatus = statusMap.map((s) => ({
          ...s,
          progress: { ...s.progress },
        }));
      });

      downloadBlob = await promise;
      currentView = "complete";
    } catch (e: any) {
      alert(get(_)("app.download_error", { values: { error: e.message } }));
      window.location.hash = "";
    }
  }

  async function handleUpload(file: File) {
    try {
      appAction = "uploading";
      currentFile = file.name;
      fileTransferStatus = [];
      currentView = "progress";

      const { promise, events } = await app.sendFile(file);

      events.on("progress", (statusMap) => {
        fileTransferStatus = statusMap.map((s) => ({
          ...s,
          progress: { ...s.progress },
        }));
      });

      uploadDescriptor = await promise;
      currentView = "result";
    } catch (err: any) {
      alert(get(_)("app.upload_error", { values: { error: err.message } }));
      currentView = "upload";
    }
  }

  function cancelDownload() {
    window.location.hash = "";
  }

  function handleToggleServer(address: string, enabled: boolean) {
    app.toggleServer(address, enabled);
    loadServers();
  }

  function handleRemoveServer(address: string) {
    app.removeServer(XftpServerAddress.create(address));
    loadServers();
  }

  async function handleRefreshServer(address: string) {
    const promise = app.refreshStatus(XftpServerAddress.create(address));
    loadServers();
    await promise;
    loadServers();
  }

  async function handleAddServer(address: string) {
    try {
      await app.addServer(XftpServerAddress.create(address));
      await app.refreshStatus(XftpServerAddress.create(address));
      loadServers();
    } catch (err: any) {
      alert(get(_)("app.add_server_error", { values: { error: err.message } }));
    }
  }
</script>

<AmbientBackground />

<Header
  showMenuButton={currentView === "upload"}
  onMenuClick={() => (isSidebarOpen = true)}
/>

<div class="flex flex-1 min-h-0 relative flex-col md:flex-row w-full">
  <!-- Left Sidebar -->
  <Sidebar
    show={currentView === "upload"}
    isOpen={isSidebarOpen}
    onClose={() => (isSidebarOpen = false)}
    {servers}
    {useCommunityServers}
    onToggleCommunityServers={handleToggleCommunityServers}
    onFetchCommunity={handleFetchCommunity}
    onClearCommunity={handleClearCommunity}
    onToggleServer={handleToggleServer}
    onRemoveServer={handleRemoveServer}
    onRefreshServer={handleRefreshServer}
    onAddServer={handleAddServer}
  />

  <!-- Main Workspace -->
  <main
    class="flex-1 overflow-y-auto relative flex flex-col w-full transition-all duration-500 items-center z-10"
  >
    <div class="flex-grow shrink-0 w-full min-h-0"></div>
    <div class="flex flex-col w-full max-w-2xl p-4 md:p-8 shrink-0">
      <div
        class="relative w-full gemini-surface rounded-[2rem] p-6 md:p-12 border border-white/50"
        style="display: grid;"
      >
        {#key currentView}
          <div
            class="w-full min-w-0"
            in:fly={{ y: 15, duration: 400, delay: 150, easing: cubicOut }}
            out:fly={{ y: -15, duration: 150, easing: cubicIn }}
            style="grid-area: 1 / 1;"
          >
            {#if currentView === "upload"}
              {#if hasAvailableServers}
                <UploadView onUpload={handleUpload} />
              {:else}
                <NoServersView hasServers={servers.length > 0} />
              {/if}
            {:else if currentView === "progress"}
              <ProgressView
                title={progressTitle}
                subtitle={progressSubtitle}
                progress={fileTransferStatus}
                mode={isDownloadMode ? "download" : "upload"}
              />
            {:else if currentView === "result"}
              <ResultView
                descriptor={uploadDescriptor}
                onNewUpload={() => {
                  currentView = "upload";
                  fileTransferStatus = [];
                }}
              />
            {:else if currentView === "confirm"}
              <ConfirmView
                title={confirmTitle}
                description={confirmDesc}
                servers={confirmServers}
                onCancel={cancelDownload}
                onConfirm={confirmAction}
              />
            {:else if currentView === "complete"}
              <CompleteView
                blob={downloadBlob}
                onBackToUpload={() => (window.location.hash = "")}
              />
            {/if}
          </div>
        {/key}
      </div>

      <div class="mt-6 md:mt-8 flex justify-center shrink-0">
        <button
          class="flex items-center gap-2 px-6 py-2 rounded-full bg-white/20 hover:bg-white/40 border border-white/50 backdrop-blur-md shadow-sm transition-all text-slate-700 font-medium text-sm hover:scale-105 active:scale-95"
          onclick={() => {
            trackEvent("click_how_it_works");
            showAbout = true;
          }}
        >
          <span>🔒</span>
          {$_("app.how_it_works")}
        </button>
      </div>

      <!-- Footer Attribution & GitHub -->
      <div
        class="mt-8 md:mt-12 flex flex-col md:flex-row items-center gap-1.5 md:gap-3 w-full justify-center shrink-0 z-10"
      >
        <!-- SimpleX -->
        <a
          href="https://simplexnetwork.org"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-500 transition-colors duration-300 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-white/40 w-max"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            ></path>
          </svg>
          {$_("app.powered_by")}
        </a>

        <div class="hidden md:block w-1 h-1 rounded-full bg-slate-300"></div>

        <!-- GitHub -->
        <a
          href="https://github.com/ed-asriyan/send"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors duration-300 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-white/40 w-max"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            ></path>
          </svg>
          {$_("app.source_code")}
        </a>
      </div>
    </div>
    <div class="flex-grow shrink-0 w-full md:min-h-12 min-h-6"></div>
  </main>
</div>

<AboutOverlay show={showAbout} onClose={() => (showAbout = false)} />
