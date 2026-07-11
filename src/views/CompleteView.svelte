<script lang="ts">
  import { _ } from "../lib/i18n";
  import { trackEvent } from "../lib/tracking";
  import { onMount } from "svelte";

  interface Props {
    blob: Blob | null;
    onBackToUpload: () => void;
  }
  let { blob, onBackToUpload }: Props = $props();

  function triggerDownload() {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (blob as any).name || "downloaded_file";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  onMount(() => {
    triggerDownload();
  });
</script>

<div class="flex-col items-center text-center flex">
  <div
    class="w-16 h-16 rounded-full bg-emerald-100/50 flex items-center justify-center mb-6 text-emerald-600"
  >
    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"
      ><path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      ></path></svg
    >
  </div>
  <h3 class="text-2xl font-medium text-slate-900 mb-2">
    {$_("complete.title")}
  </h3>
  <p class="text-slate-500 text-sm mb-8 max-w-md">{$_("complete.subtitle")}</p>

  <div class="text-sm text-slate-500 mb-10">
    {$_("complete.manual_prompt")}
    <button
      onclick={() => {
        trackEvent("click_manual_download");
        triggerDownload();
      }}
      class="text-indigo-600 hover:text-indigo-700 font-medium underline underline-offset-4 decoration-indigo-200 hover:decoration-indigo-500 transition-colors"
      >{$_("complete.click_here")}</button
    >.
  </div>

  <button
    onclick={() => {
      trackEvent("click_send_own_file");
      onBackToUpload();
    }}
    class="px-8 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10 font-medium transition-colors"
  >
    {$_("complete.send_own")}
  </button>
</div>
