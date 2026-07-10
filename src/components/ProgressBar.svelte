<script lang="ts">
  import ScrollingText from "./ScrollingText.svelte";

  interface Props {
    serverName: string;
    percent: number;
  }
  let { serverName, percent }: Props = $props();
</script>

<div class="w-full">
  <div class="flex justify-between items-center text-sm mb-2 text-slate-600">
    <ScrollingText text={serverName} class="font-mono mr-4 flex-1 min-w-0" />
    <span class="font-medium shrink-0">{percent}%</span>
  </div>
  <div class="w-full bg-black/5 rounded-full h-2 overflow-hidden">
    <div
      class="bg-indigo-500 h-2 rounded-full transition-all duration-300 ease-out"
      style="width: {percent}%"
    ></div>
  </div>
</div>
