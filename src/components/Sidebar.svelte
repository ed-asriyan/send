<script lang="ts">
  import type { XftpServer } from "../lib/models";
  import { fade, slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { _ } from "../lib/i18n";
  import LanguageSwitcher from "./LanguageSwitcher.svelte";

  interface Props {
    show?: boolean;
    isOpen: boolean;
    onClose: () => void;
    servers: XftpServer[];
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
    onToggleServer,
    onRemoveServer,
    onRefreshServer,
    onAddServer,
  }: Props = $props();

  let newServerInput = $state("");
  let isAdding = $state(false);

  async function handleAddServer(e: Event) {
    e.preventDefault();
    const addr = newServerInput.trim();
    if (addr) {
      isAdding = true;
      try {
        await onAddServer(addr);
        newServerInput = "";
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
              <div
                class="text-sm font-medium text-slate-800 truncate font-mono"
              >
                {srv.server.getDomain()}
              </div>
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
                href={"https://" + srv.server.getDomain()}
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
            </div>
          </div>
        {/each}
      </div>

      <div class="p-6 shrink-0">
        <form onsubmit={handleAddServer} class="flex flex-col gap-3">
          <input
            type="text"
            bind:value={newServerInput}
            placeholder={$_("sidebar.inputs.placeholder")}
            class="w-full px-4 py-3 text-sm gemini-input rounded-2xl outline-none placeholder:text-slate-400 font-mono"
            required
          />
          <button
            type="submit"
            disabled={isAdding}
            class="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-3 px-4 rounded-full transition-colors shadow-md shadow-slate-900/10 disabled:opacity-50"
          >
            {isAdding
              ? $_("sidebar.inputs.adding")
              : $_("sidebar.inputs.add_server")}
          </button>
        </form>
      </div>
    </aside>
  </div>
{/if}
