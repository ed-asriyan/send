<script lang="ts">
  import type { FileTransferStatus } from ".././lib/models";
  import NetworkGraph from "../components/NetworkGraph.svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface Props {
    title: string;
    subtitle: string;
    progress: FileTransferStatus;
    mode: "upload" | "download";
  }
  let { title, subtitle, progress, mode }: Props = $props();
</script>

<div class="flex-col w-full flex min-w-0">
  <div class="mb-8 relative w-full min-w-0" style="display: grid;">
    {#key title + subtitle}
      <div
        in:fly={{ y: 15, duration: 400, delay: 150, easing: cubicOut }}
        out:fly={{ y: -15, duration: 150 }}
        style="grid-area: 1 / 1;"
        class="w-full min-w-0 overflow-hidden"
      >
        <h3
          class="text-2xl font-medium text-slate-900 mb-2 truncate max-w-full"
        >
          {title}
        </h3>
        <p class="text-slate-500 text-sm truncate max-w-full">{subtitle}</p>
      </div>
    {/key}
  </div>

  {#if progress && progress.length > 0}
    <NetworkGraph {progress} {mode} />
  {/if}

  {#if Object.keys(progress).length === 0}
    <div class="flex items-center justify-center p-8">
      <div
        class="animate-spin w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600"
      ></div>
    </div>
  {/if}
</div>
