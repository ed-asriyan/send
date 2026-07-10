<script lang="ts">
  import { _ } from "../lib/i18n";
  import { trackEvent } from "../lib/tracking";
  import { fly, slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import ScrollingText from "../components/ScrollingText.svelte";

  interface Props {
    title: string;
    description: string;
    servers: string[];
    onCancel: () => void | Promise<void>;
    onConfirm: () => void | Promise<void>;
  }
  let { title, description, servers, onCancel, onConfirm }: Props = $props();

  let isLoading = $state(false);
  let showServers = $state(false);

  async function handleConfirm() {
    if (isLoading) return;
    trackEvent("click_download");
    isLoading = true;
    try {
      await onConfirm();
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="relative w-full" style="display: grid;">
  {#key title}
    <div
      in:fly={{ y: 15, duration: 400, delay: 150, easing: cubicOut }}
      out:fly={{ y: -15, duration: 150 }}
      class="flex-col items-center text-center flex w-full"
      style="grid-area: 1 / 1;"
    >
      <div
        class="w-16 h-16 rounded-full bg-blue-100/50 flex items-center justify-center mb-6 text-blue-600"
      >
        <svg
          class="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          ></path></svg
        >
      </div>
      <ScrollingText
        text={title}
        class="text-2xl font-medium text-slate-900 mb-3 justify-center"
      />
      {#if description}
        <p class="text-slate-500 text-sm mb-6 max-w-md">{description}</p>
      {/if}

      <div class="mb-8">
        <button
          class="text-blue-500 hover:text-blue-600 text-sm font-medium transition-colors underline decoration-blue-500/30 underline-offset-4"
          onclick={() => (showServers = !showServers)}
        >
          {showServers
            ? $_("confirm.hide_servers")
            : $_("confirm.view_servers")}
        </button>
      </div>

      {#if showServers}
        <div
          transition:slide
          class="w-full text-left bg-black/5 rounded-2xl p-4 mb-8 max-h-48 overflow-y-auto space-y-3 font-mono text-sm text-slate-600"
        >
          {#each servers as server}
            <div class="flex items-center gap-3">
              <div class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></div>
              <a
                href={"https://" + server}
                target="_blank"
                rel="noopener noreferrer"
                class="truncate hover:underline cursor-pointer"
              >
                {server}
              </a>
            </div>
          {/each}
        </div>
      {/if}

      <div class="flex flex-col md:flex-row gap-4 w-full justify-center">
        <button
          onclick={onCancel}
          disabled={isLoading}
          class="px-8 py-3 rounded-full bg-black/5 hover:bg-black/10 text-slate-700 font-medium transition-colors w-full md:w-auto disabled:opacity-50"
          >{$_("confirm.cancel")}</button
        >
        <button
          onclick={handleConfirm}
          disabled={isLoading}
          class="px-8 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10 font-medium transition-colors w-full md:w-auto disabled:opacity-50"
        >
          {isLoading ? $_("confirm.starting") : $_("confirm.start_download")}
        </button>
      </div>
    </div>
  {/key}
</div>
