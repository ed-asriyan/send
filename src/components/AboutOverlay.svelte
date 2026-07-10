<script lang="ts">
  import { _ } from "../lib/i18n";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface Props {
    show: boolean;
    onClose: () => void;
  }

  let { show, onClose }: Props = $props();
</script>

{#if show}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/40 backdrop-blur-md"
    transition:fade={{ duration: 150 }}
  >
    <div
      class="relative w-full max-w-2xl bg-white/95 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-[2rem] p-6 md:p-12 overflow-y-auto"
      transition:fly={{ y: 20, duration: 250, easing: cubicOut }}
      style="max-height: 90vh;"
    >
      <button
        class="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
        onclick={onClose}
        aria-label="Close"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          ></path>
        </svg>
      </button>

      <h2
        class="text-2xl md:text-3xl font-semibold text-slate-900 mb-6 pr-12 md:pr-0"
      >
        {$_("about.title")}
      </h2>

      <p class="text-slate-600 mb-10 text-lg leading-relaxed">
        {$_("about.intro")}
      </p>

      <div class="space-y-8">
        <div class="flex items-start gap-4">
          <div
            class="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl shrink-0 shadow-sm border border-indigo-200/50"
          >
            🧩
          </div>
          <div>
            <h3 class="text-xl font-medium text-slate-800 mb-2">
              {$_("about.split.title")}
            </h3>
            <p class="text-slate-500 leading-relaxed">
              {$_("about.split.desc")}
            </p>
          </div>
        </div>

        <div class="flex items-start gap-4">
          <div
            class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shrink-0 shadow-sm border border-emerald-200/50"
          >
            🗝️
          </div>
          <div>
            <h3 class="text-xl font-medium text-slate-800 mb-2">
              {$_("about.key.title")}
            </h3>
            <p class="text-slate-500 leading-relaxed">
              {$_("about.key.desc")}
            </p>
          </div>
        </div>

        <div class="flex items-start gap-4">
          <div
            class="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center text-2xl shrink-0 shadow-sm border border-purple-200/50"
          >
            👻
          </div>
          <div>
            <h3 class="text-xl font-medium text-slate-800 mb-2">
              {$_("about.anon.title")}
            </h3>
            <p class="text-slate-500 leading-relaxed">
              {$_("about.anon.desc")}
            </p>
          </div>
        </div>
      </div>

      <div class="mt-8 pt-8 border-t border-slate-200/50">
        <h4
          class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6"
        >
          {$_("about.hood.title")}
        </h4>

        <p class="font-medium text-slate-800 text-sm mb-4">
          {$_("about.hood.intro")}
        </p>

        <div class="space-y-4 text-sm text-slate-600">
          <div>
            <strong class="text-slate-800"
              >{$_("about.steps.availability.title")}</strong
            >
            {$_("about.steps.availability.desc")}
            <em>{$_("about.steps.availability.note")}</em>
          </div>
          <div>
            <strong class="text-slate-800"
              >{$_("about.steps.sharding.title")}</strong
            >
            {$_("about.steps.sharding.desc")}
          </div>
          <div>
            <strong class="text-slate-800"
              >{$_("about.steps.dispatch.title")}</strong
            >
            {$_("about.steps.dispatch.desc")}
          </div>
          <div>
            <strong class="text-slate-800">{$_("about.steps.map.title")}</strong
            >
            {$_("about.steps.map.desc")}
          </div>
          <div>
            <strong class="text-slate-800"
              >{$_("about.steps.hash.title")}</strong
            >
            {$_("about.steps.hash.desc")}
            <em>{$_("about.steps.hash.note")}</em>
          </div>
        </div>

        <div class="mt-3 pt-3 text-sm text-slate-600 leading-relaxed">
          {$_("about.reverse")}
        </div>
      </div>

      <div class="mt-10 flex justify-center">
        <button
          onclick={onClose}
          class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-8 rounded-full shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-base"
        >
          {$_("about.got_it")}
        </button>
      </div>
    </div>
  </div>
{/if}
