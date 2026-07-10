<script lang="ts">
  import { locale } from "../lib/i18n";
  import { fade, scale } from "svelte/transition";
  import { onMount } from "svelte";

  let isOpen = $state(false);
  let buttonRef: HTMLButtonElement;
  let menuRef: HTMLDivElement;

  const languages = [
    { code: "en", name: "English" },
    { code: "ru", name: "Русский" },
    { code: "fr", name: "Français" },
  ];

  let currentLang = $derived(
    languages.find((l) => l.code === $locale) || languages[0],
  );

  function toggleMenu() {
    isOpen = !isOpen;
  }

  function setLanguage(code: string) {
    $locale = code;
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      isOpen &&
      buttonRef &&
      !buttonRef.contains(event.target as Node) &&
      menuRef &&
      !menuRef.contains(event.target as Node)
    ) {
      isOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  });
</script>

<div class="relative inline-block text-left">
  <button
    bind:this={buttonRef}
    onclick={toggleMenu}
    class="flex items-center gap-2 px-3 py-2 backdrop-blur-md bg-white/40 hover:bg-white/60 rounded-full text-slate-700 shadow-sm transition-all focus:outline-none"
  >
    <svg
      class="w-5 h-5 text-indigo-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      ></path>
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M3.6 9h16.8M3.6 15h16.8"
      ></path>
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 3a9 9 0 00-3.6 9 9 9 0 003.6 9 9 9 0 003.6-9 9 9 0 00-3.6-9z"
      ></path>
    </svg>
    <span class="text-sm font-medium uppercase">{currentLang.code}</span>
  </button>

  {#if isOpen}
    <div
      bind:this={menuRef}
      transition:scale={{ duration: 150, start: 0.95 }}
      class="origin-top-right absolute right-0 mt-2 w-32 rounded-2xl bg-white/80 backdrop-blur-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden"
    >
      <div class="py-1">
        {#each languages as lang}
          <button
            onclick={() => setLanguage(lang.code)}
            class="w-full text-left px-4 py-2 text-sm {currentLang.code ===
            lang.code
              ? 'text-indigo-600 bg-indigo-50/50'
              : 'text-slate-700 hover:bg-white/50'} transition-colors"
          >
            {lang.name}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
