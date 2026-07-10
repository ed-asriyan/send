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

<!-- Mobile Overlay -->
{#if show}
  {#if isOpen}
    <div
      class="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 transition-opacity duration-300 md:hidden"
      onclick={onClose}
    ></div>
  {/if}

  <!-- Left Sidebar Wrapper -->
  <div
    transition:slide={{ axis: "x", duration: 400, easing: cubicOut }}
    class="fixed inset-y-0 left-0 z-40 md:static md:flex-shrink-0 pointer-events-none md:pointer-events-auto"
  >
    <aside
      in:fade={{ duration: 300, delay: 100 }}
      out:fade={{ duration: 200 }}
      class="relative w-72 lg:w-80 h-full transform {isOpen
        ? 'translate-x-0'
        : '-translate-x-full'} md:translate-x-0 flex flex-col transition-transform duration-300 ease-in-out bg-white/80 md:bg-transparent backdrop-blur-2xl md:backdrop-blur-none shadow-2xl md:shadow-none pointer-events-auto"
    >
      <div class="p-6 md:p-8 flex items-center justify-end shrink-0 md:hidden">
        <button
          type="button"
          onclick={onClose}
          class="md:hidden p-2 text-slate-400 hover:bg-black/5 rounded-full"
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

      <div
        class="px-6 pb-2 md:pt-4 text-xs font-semibold text-slate-400 uppercase tracking-widest"
      >
        {$_("sidebar.servers")}
      </div>

      <div class="flex-1 overflow-y-auto px-4 space-y-1">
        {#if servers.length === 0}
          <div
            class="h-full flex flex-col items-center justify-center p-8 text-center"
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
              {$_("sidebar.empty_list")}
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
                    ? $_("sidebar.status.checking")
                    : isError
                      ? $_("sidebar.status.offline")
                      : $_("sidebar.status.online")}
                </div>
              </div>

              <div
                class="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              >
                <a
                  href={`https://${srv.server.url.host}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onclick={(e) => e.stopPropagation()}
                  class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-full transition-colors"
                  title={$_("sidebar.tooltips.view_info")}
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
                  title={$_("sidebar.tooltips.check")}
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
                    title={$_("sidebar.tooltips.remove")}
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
          <span class="group-hover:text-indigo-600 transition-colors text-left">
            {$_("sidebar.community_auto_fetch")}
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
              {$_("sidebar.community_fetching")}
            {:else}
              <span class="mr-1.5">🌍</span>
              {$_("sidebar.community_fetch")}
            {/if}
          </button>
          <button
            type="button"
            onclick={onClearCommunity}
            class="px-3 py-2 text-xs rounded-full bg-white/20 hover:bg-red-50 hover:border-red-200 border border-white/50 backdrop-blur-md shadow-sm transition-all text-slate-700 hover:text-red-600 font-medium hover:scale-[1.02] active:scale-95 flex items-center justify-center"
            title={$_("sidebar.community_clear")}
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

        {#if isAddFormOpen}
          <form
            onsubmit={handleAddServer}
            class="flex flex-col gap-4"
            in:slide={{ duration: 250, easing: cubicOut }}
          >
            <input
              type="text"
              bind:value={newServerInput}
              placeholder={$_("sidebar.inputs.placeholder")}
              class="w-full px-4 py-3 text-sm gemini-input rounded-2xl outline-none placeholder:text-slate-400 font-mono"
              required
              autofocus
            />
            <div class="flex gap-2">
              <button
                type="button"
                onclick={() => {
                  isAddFormOpen = false;
                  newServerInput = "";
                }}
                class="bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 py-3 px-4 rounded-full transition-colors flex items-center justify-center"
                title={$_("confirm.cancel")}
              >
                <svg
                  class="w-4 h-4 mx-auto"
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
              <button
                type="submit"
                disabled={isAdding || !isNewServerValid}
                class="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-3 px-4 rounded-full transition-colors shadow-md shadow-slate-900/10 disabled:opacity-50"
              >
                {isAdding
                  ? $_("sidebar.inputs.adding")
                  : $_("sidebar.inputs.add_server")}
              </button>
            </div>
            <div class="text-center -mt-2">
              <a
                href="https://github.com/ed-asriyan/simplex-servers-docker#-quick-start-xftp-server"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                {$_("sidebar.inputs.how_to_create")}
              </a>
            </div>
          </form>
        {:else}
          <button
            type="button"
            onclick={() => (isAddFormOpen = true)}
            class="w-full border-2 border-dashed border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-white/50 text-sm font-medium py-3 px-4 rounded-full transition-all duration-300"
          >
            + {$_("sidebar.inputs.add_server")}
          </button>
        {/if}
      </div>
    </aside>
  </div>
{/if}
