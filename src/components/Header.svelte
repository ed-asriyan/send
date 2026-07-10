<script lang="ts">
  import { _ } from "../lib/i18n";
  import LanguageSwitcher from "./LanguageSwitcher.svelte";
  import ScrollingText from "./ScrollingText.svelte";

  interface Props {
    onMenuClick?: () => void;
    showMenuButton?: boolean;
  }
  let { onMenuClick, showMenuButton = true }: Props = $props();
</script>

<header
  class="flex items-center justify-between p-4 md:px-8 md:py-6 bg-transparent shrink-0 z-20 relative"
>
  <div
    class="flex items-center gap-2 text-xl font-bold text-slate-800 tracking-tight"
  >
    <svg
      class="w-6 h-6 text-indigo-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2.5"
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      ></path>
    </svg>
    <ScrollingText text={$_("sidebar.title")} class="max-w-[200px]" />
  </div>
  <div class="flex items-center gap-2">
    <LanguageSwitcher />
    {#if showMenuButton}
      <button
        type="button"
        onclick={onMenuClick}
        class="md:hidden p-2 text-slate-600 hover:bg-black/5 rounded-full transition-colors focus:outline-none"
      >
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          ></path>
        </svg>
      </button>
    {/if}
  </div>
</header>
