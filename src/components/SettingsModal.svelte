<script lang="ts">
  import { XftpServerAddress, type XftpServer } from "../lib/models";
  import { trackEvent } from "../lib/tracking";
  import { fade, slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { _ } from "../lib/i18n";
  import ScrollingText from "./ScrollingText.svelte";

  interface Props {
    show?: boolean;
    isOpen: boolean;
    onClose: () => void;
    servers: XftpServer[];
    useCommunityServers: boolean;
    onToggleCommunityServers: (enabled: boolean) => void;
    onFetchCommunity: () => Promise<void>;
    onClearCommunity: () => void;
    onToggleServer: (address: string, enabled: boolean) => void;
    onRemoveServer: (address: string) => void;
    onRefreshServer: (address: string) => void;
    onAddServer: (address: string) => Promise<void>;
  }

  let {
    show = true,
    isOpen,
    onClose,
    servers,
    useCommunityServers,
    onToggleCommunityServers,
    onFetchCommunity,
    onClearCommunity,
    onToggleServer,
    onRemoveServer,
    onRefreshServer,
    onAddServer,
  }: Props = $props();

  let newServerInput = $state("");
  let isAdding = $state(false);
  let isAddFormOpen = $state(false);
  let isFetchingCommunity = $state(false);

  let isNewServerValid = $derived.by(() => {
    try {
      XftpServerAddress.create(newServerInput.trim());
      return true;
    } catch {
      return false;
    }
  });

  async function handleAddServer(e: Event) {
    e.preventDefault();
    const addr = newServerInput.trim();
    if (addr && isNewServerValid) {
      trackEvent("add_server");
      isAdding = true;
      try {
        await onAddServer(addr);
        newServerInput = "";
        isAddFormOpen = false;
      } finally {
        isAdding = false;
      }
    }
  }

  function mountTile(node: HTMLElement, address: string) {
    onRefreshServer(address);
  }
</script>

<!-- Settings Modal Component -->
{#if show && isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity duration-300"
    onclick={onClose}
    transition:fade={{ duration: 200 }}
  ></div>

  <!-- Modal Wrapper -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 pointer-events-none"
  >
    <div
      transition:fade={{ duration: 200, easing: cubicOut }}
      class="relative w-full max-w-xl max-h-full flex flex-col bg-white/95 backdrop-blur-3xl shadow-2xl rounded-[2rem] pointer-events-auto overflow-hidden"
    >
      <!-- Header -->
      <div
        class="p-6 md:p-8 flex items-center justify-between shrink-0 border-b border-black/5"
      >
        <h2 class="text-2xl font-medium text-slate-800 tracking-tight">
          {$_("settings.title")}
        </h2>
        <button
          type="button"
          onclick={onClose}
          class="p-2 text-slate-400 hover:bg-black/5 rounded-full"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path></svg
          >
        </button>
      </div>

      <!-- Body -->
      <div class="overflow-y-auto flex-1 hide-scrollbar">
        <div
          class="px-6 pt-6 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-widest"
        >
          {$_("settings.servers")}
        </div>

        <div
          class="flex-1 overflow-y-auto px-4 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start min-h-[140px]"
        >
          {#if servers.length === 0}
            <div
              class="col-span-full h-full flex flex-col items-center justify-center p-8 text-center"
              in:fade={{ duration: 300 }}
            >
              <div
                class="w-16 h-16 mb-6 rounded-[2rem] bg-indigo-50/50 flex items-center justify-center text-3xl shadow-sm border border-white/50 backdrop-blur-sm"
              >
                🛰️
              </div>
              <p
                class="text-sm text-slate-400 font-medium leading-relaxed max-w-[200px]"
              >
                {$_("settings.empty_list")}
              </p>
            </div>
          {:else}
            {#each servers as srv (srv.server.address)}
              {@const isChecking = srv.status === "checking"}
              {@const isError = srv.status !== true && !isChecking}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                use:mountTile={srv.server.address}
                class="group flex items-center p-3 border border-transparent rounded-2xl transition-all cursor-pointer {!srv.enabled
                  ? 'hover:bg-black/5'
                  : isChecking
                    ? 'bg-yellow-50/50'
                    : isError
                      ? 'bg-red-50/50'
                      : 'gemini-surface !border-white/50'}"
                onclick={() => onToggleServer(srv.server.address, !srv.enabled)}
              >
                <div class="flex-1 min-w-0 mr-2 ml-1">
                  <ScrollingText
                    text={srv.server.url.host}
                    class="text-sm font-medium text-slate-800 font-mono"
                  />
                  <div
                    class="text-xs {isChecking
                      ? 'text-yellow-600'
                      : isError
                        ? 'text-red-500'
                        : 'text-slate-500'} flex items-center gap-1.5 mt-0.5 transition-colors"
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full {isChecking
                        ? 'bg-yellow-400'
                        : isError
                          ? 'bg-red-400'
                          : 'bg-emerald-400'}"
                    ></span>
                    {isChecking
                      ? $_("settings.status.checking")
                      : isError
                        ? $_("settings.status.offline")
                        : $_("settings.status.online")}
                  </div>
                </div>

                <div
                  class="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                >
                  <a
                    href={srv.server.getWebOrigin()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onclick={(e) => e.stopPropagation()}
                    class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-full transition-colors"
                    title={$_("settings.tooltips.view_info")}
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
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </a>
                  <button
                    type="button"
                    onclick={(e) => {
                      e.stopPropagation();
                      onRefreshServer(srv.server.address);
                    }}
                    class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-full transition-colors"
                    title={$_("settings.tooltips.check")}
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path></svg
                    >
                  </button>
                  {#if !srv.isCommunity}
                    <button
                      type="button"
                      onclick={(e) => {
                        e.stopPropagation();
                        onRemoveServer(srv.server.address);
                      }}
                      class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-full transition-colors"
                      title={$_("settings.tooltips.remove")}
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path></svg
                      >
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <div
          class="p-6 pt-2 shrink-0 border-t border-white/20 mt-0 flex flex-col gap-5"
        >
          <!-- Community Toggle -->
          <button
            type="button"
            onclick={() => onToggleCommunityServers(!useCommunityServers)}
            class="flex items-center w-full justify-between gap-3 p-1.5 pl-3 rounded-2xl hover:bg-black/5 transition-all text-sm text-slate-700 font-medium group"
          >
            <span
              class="group-hover:text-indigo-600 transition-colors text-left"
            >
              {$_("settings.community_auto_fetch")}
            </span>
            <div
              class="shrink-0 relative w-10 h-6 rounded-full transition-colors flex items-center px-1 {useCommunityServers
                ? 'bg-indigo-500'
                : 'bg-slate-300'}"
            >
              <div
                class="w-4 h-4 rounded-full bg-white shadow-sm transition-transform {useCommunityServers
                  ? 'translate-x-4'
                  : 'translate-x-0'}"
              ></div>
            </div>
          </button>

          <div class="flex gap-2">
            <button
              type="button"
              disabled={isFetchingCommunity}
              onclick={async () => {
                isFetchingCommunity = true;
                try {
                  await onFetchCommunity();
                } finally {
                  isFetchingCommunity = false;
                }
              }}
              class="flex-1 px-3 py-2 text-xs rounded-full bg-white/20 hover:bg-white/40 border border-white/50 backdrop-blur-md shadow-sm transition-all text-slate-700 font-medium disabled:opacity-50 flex items-center justify-center hover:scale-[1.02] active:scale-95"
            >
              {#if isFetchingCommunity}
                <svg
                  class="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-700"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {$_("settings.community_fetching")}
              {:else}
                <span class="mr-1.5">🌍</span>
                {$_("settings.community_fetch")}
              {/if}
            </button>
            <button
              type="button"
              onclick={onClearCommunity}
              class="px-3 py-2 text-xs rounded-full bg-white/20 hover:bg-red-50 hover:border-red-200 border border-white/50 backdrop-blur-md shadow-sm transition-all text-slate-700 hover:text-red-600 font-medium hover:scale-[1.02] active:scale-95 flex items-center justify-center"
              title={$_("settings.community_clear")}
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                ></path></svg
              >
            </button>
          </div>

          <form onsubmit={handleAddServer} class="flex flex-col gap-4">
            <input
              type="text"
              bind:value={newServerInput}
              placeholder={$_("settings.inputs.placeholder")}
              class="w-full px-4 py-3 text-sm gemini-input rounded-2xl outline-none placeholder:text-slate-400 font-mono"
              required
            />
            <button
              type="submit"
              disabled={isAdding ||
                (newServerInput.trim() !== "" && !isNewServerValid)}
              class="w-full bg-slate-500 hover:bg-slate-600 text-white text-sm font-medium py-3 px-4 rounded-full transition-colors shadow-md disabled:opacity-50"
            >
              {isAdding
                ? $_("settings.inputs.adding")
                : $_("settings.inputs.add_server")}
            </button>
            <div class="text-center -mt-2">
              <a
                href="https://github.com/ed-asriyan/simplex-servers-docker#-quick-start-xftp-server"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                {$_("settings.inputs.how_to_create")}
              </a>
            </div>
          </form>
        </div>
      </div>
      <!-- End Body -->
    </div>
    <!-- End Modal Content -->
  </div>
  <!-- End Modal Wrapper -->
{/if}
