<script lang="ts">
  import { _ } from "../lib/i18n";
  interface Props {
    hasServers: boolean;
  }
  let { hasServers }: Props = $props();
</script>

<div class="flex-col items-center text-center flex">
  <div
    class="w-full border-2 border-dashed rounded-[2rem] p-10 md:p-16 border-amber-200/50 bg-amber-50/10 flex flex-col items-center"
  >
    <div
      class="w-16 h-16 mb-6 rounded-full bg-amber-100/50 flex items-center justify-center"
    >
      <svg
        class="w-8 h-8 text-amber-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        ></path>
      </svg>
    </div>
    <h3 class="text-xl md:text-2xl font-medium text-slate-800 mb-2">
      {#if hasServers}
        {$_("no_servers.title_active")}
      {:else}
        {$_("no_servers.title_empty")}
      {/if}
    </h3>
    <p class="text-slate-500 text-sm max-w-sm">
      {#if hasServers}
        {$_("no_servers.subtitle_active")}
      {:else}
        {$_("no_servers.subtitle_empty")}
      {/if}
    </p>
  </div>
</div>
