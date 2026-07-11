<script lang="ts">
  import { _ } from "../lib/i18n";
  import { trackEvent } from "../lib/tracking";

  interface Props {
    onUpload: (file: File) => void | Promise<void>;
  }
  let { onUpload }: Props = $props();

  let isDragging = $state(false);
  let isUploading = $state(false);
  let fileInput: HTMLInputElement;

  function handleDragOver(e: DragEvent) {
    if (isUploading) return;
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    if (isUploading) return;
    isDragging = false;
  }

  async function handleDrop(e: DragEvent) {
    if (isUploading) return;
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer?.files.length) {
      isUploading = true;
      try {
        await onUpload(e.dataTransfer.files[0]);
      } finally {
        isUploading = false;
      }
    }
  }

  async function handleFileChange(e: Event) {
    if (isUploading) return;
    const target = e.target as HTMLInputElement;
    if (target.files?.length) {
      isUploading = true;
      try {
        await onUpload(target.files[0]);
      } finally {
        isUploading = false;
        fileInput.value = "";
      }
    }
  }
</script>

<div
  class="flex-col items-center text-center flex {isUploading
    ? 'opacity-50 pointer-events-none'
    : ''}"
>
  <div
    class="w-full border-2 border-dashed rounded-[2rem] p-10 md:p-16 transition-all cursor-pointer group flex flex-col items-center {isDragging
      ? 'border-indigo-400 bg-indigo-50/50'
      : 'border-indigo-200/50 hover:bg-indigo-50/30 hover:border-indigo-400/50'}"
    onclick={() => {
      if (!isUploading) {
        trackEvent("click_upload");
        fileInput.click();
      }
    }}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Enter" && !isUploading) fileInput.click();
    }}
  >
    <div
      class="w-16 h-16 mb-6 rounded-full bg-indigo-100/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
    >
      <svg
        class="w-8 h-8 text-indigo-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        ></path></svg
      >
    </div>
    <h3 class="text-xl md:text-2xl font-medium text-slate-800 mb-2">
      {isUploading ? $_("upload.preparing") : $_("upload.title")}
    </h3>
    <p class="text-slate-500 text-sm mb-8">{$_("upload.subtitle")}</p>
    <input
      type="file"
      bind:this={fileInput}
      onchange={handleFileChange}
      class="hidden"
    />
    <button
      disabled={isUploading}
      class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-8 rounded-full shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-sm md:text-base disabled:bg-indigo-400 disabled:active:scale-100"
    >
      {isUploading ? $_("upload.processing") : $_("upload.button")}
    </button>
  </div>
</div>
