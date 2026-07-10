<script lang="ts">
  import { _ } from "../lib/i18n";
  import { onMount } from "svelte";
  import QRCode from "qrcode";

  interface Props {
    descriptor: string;
    onNewUpload: () => void;
  }
  let { descriptor, onNewUpload }: Props = $props();

  let shareUrl = $derived(
    `${window.location.origin}${window.location.pathname}#${descriptor}`,
  );
  let qrCodeCanvas: HTMLCanvasElement;
  let urlInput: HTMLInputElement;
  let isCopied = $state(false);

  $effect(() => {
    if (qrCodeCanvas && shareUrl) {
      QRCode.toCanvas(
        qrCodeCanvas,
        shareUrl,
        {
          width: 140,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        },
        (error) => {
          if (error) console.error(error);
        },
      );
    }
  });

  function copyUrl() {
    urlInput.select();
    document.execCommand("copy");
    isCopied = true;
    setTimeout(() => (isCopied = false), 2000);
  }

  async function shareLink() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: $_("result.share_title"),
          url: shareUrl,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Error sharing:", err);
        }
      }
    }
  }
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
        d="M5 13l4 4L19 7"
      ></path></svg
    >
  </div>
  <h3 class="text-2xl font-medium text-slate-900 mb-2">{$_("result.title")}</h3>
  <p class="text-slate-500 text-sm mb-8 max-w-md">{$_("result.subtitle")}</p>

  <div
    class="w-full bg-black/5 p-1.5 md:p-2 rounded-2xl flex items-center gap-2 mb-8"
  >
    <input
      type="text"
      bind:this={urlInput}
      value={shareUrl}
      readonly
      class="flex-1 bg-transparent px-4 outline-none text-slate-600 text-sm font-mono truncate"
    />
    <button
      onclick={copyUrl}
      class="bg-white hover:bg-slate-50 text-slate-700 p-2.5 rounded-xl transition-colors shadow-sm shrink-0"
      title={$_("result.copy")}
    >
      {#if isCopied}
        <svg
          class="w-5 h-5 text-emerald-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          ></path></svg
        >
      {:else}
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          ></path></svg
        >
      {/if}
    </button>
    {#if navigator.share}
      <button
        onclick={shareLink}
        class="bg-white hover:bg-slate-50 text-slate-700 p-2.5 rounded-xl transition-colors shadow-sm shrink-0"
        title={$_("result.share")}
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
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          ></path></svg
        >
      </button>
    {/if}
  </div>

  <div class="p-4 bg-white rounded-3xl shadow-sm inline-block mb-6">
    <canvas bind:this={qrCodeCanvas}></canvas>
  </div>

  <button
    onclick={onNewUpload}
    class="text-indigo-600 hover:text-indigo-700 font-medium text-sm transition-colors px-4 py-2 hover:bg-indigo-50 rounded-full"
  >
    {$_("result.upload_another")}
  </button>
</div>
