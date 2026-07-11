<script lang="ts">
  import { _ } from "../lib/i18n";
  import type { FileTransferStatus } from "../lib/models";

  interface Props {
    progress: FileTransferStatus;
    mode?: "upload" | "download";
  }

  let { progress = [], mode = "upload" }: Props = $props();

  let containerWidth = $state(500);

  // Use dynamic width based on container, but cap at 500px for desktop.
  let width = $derived(containerWidth > 0 ? containerWidth : 500);

  // Dynamic height, so servers have enough space (minimum 200px)
  let height = $derived(Math.max(200, progress.length * 70));

  // Coordinates of local device (left boundary flush)
  const startX = 32;
  let startY = $derived(height / 2);

  // Coordinates of server zone (leaving 110px for domain text)
  let endX = $derived(Math.max(startX + 100, width - 110));

  let serverNodes = $derived(
    progress.map((item, i) => {
      // Distribute evenly across available height
      const step = height / (progress.length + 1);
      const stats = item.progress;
      return {
        name: item.server.url.hostname,
        y: step * (i + 1),
        // Calculate percentage (0-100)
        percent: stats?.max ? Math.round((stats.current / stats.max) * 100) : 0,
      };
    }),
  );

  let totalPercent = $derived.by(() => {
    let current = 0;
    let max = 0;
    for (const p of progress) {
      if (p.progress && p.progress.max) {
        current += p.progress.current;
        max += p.progress.max;
      }
    }
    return max > 0 ? Math.round((current / max) * 100) : 0;
  });

  // Function to create a smooth Bezier curve
  function getBezierPath(x1: number, y1: number, x2: number, y2: number) {
    // Control points shifted along X-axis to create a nice S-curve
    const cp1x = x1 + (x2 - x1) * 0.5;
    const cp1y = y1;
    const cp2x = x1 + (x2 - x1) * 0.5;
    const cp2y = y2;
    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  }
</script>

<div
  class="relative w-full mb-0 flex flex-col justify-center items-center overflow-visible"
  bind:clientWidth={containerWidth}
>
  <!-- Use viewBox for responsiveness -->
  <svg
    viewBox="0 0 {width} {height}"
    class="w-full max-w-[500px] mx-auto h-auto overflow-visible"
    style="min-height: 200px;"
  >
    <!-- Lines to servers -->
    {#each serverNodes as node}
      {@const d = getBezierPath(startX, startY, endX, node.y)}

      <!-- 1. Background semi-transparent line (track) -->
      <path
        {d}
        fill="none"
        stroke="rgba(139, 92, 246, 0.15)"
        stroke-width="3"
        stroke-linecap="round"
      />

      <!-- 2. Progress line (filled from 0 to 100) -->
      <!-- Trick: pathLength="100" allows using percentages in dasharray directly -->
      <path
        {d}
        fill="none"
        stroke="#8b5cf6"
        stroke-width="3"
        stroke-linecap="round"
        pathLength="100"
        stroke-dasharray="100"
        stroke-dashoffset={mode === "upload"
          ? 100 - node.percent
          : -(100 - node.percent)}
        class="transition-all duration-300 ease-out"
      />

      <!-- 3. Animation of flowing data (visible only where there is progress) -->
      <path
        {d}
        fill="none"
        stroke="#ffffff"
        stroke-width="1.5"
        stroke-linecap="round"
        class="data-flow opacity-60 {mode === 'upload'
          ? 'flow-upload'
          : 'flow-download'}"
      />
    {/each}

    <!-- Server nodes (Right) -->
    {#each serverNodes as node}
      <a
        href={"https://" + node.name}
        target="_blank"
        rel="noopener noreferrer"
        class="server-node group cursor-pointer"
      >
        <g transform="translate({endX}, {node.y})">
          <!-- Circle background -->
          <circle
            cx="0"
            cy="0"
            r="18"
            fill="rgba(255, 255, 255, 0.8)"
            stroke="#cbd5e1"
            stroke-width="1.5"
            class="backdrop-blur-sm"
          />
          <!-- Server icon -->
          <svg
            x="-9"
            y="-9"
            width="18"
            height="18"
            fill="none"
            stroke="#64748b"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="2" y="3" width="14" height="4" rx="1"></rect>
            <rect x="2" y="11" width="14" height="4" rx="1"></rect>
          </svg>

          <!-- Server label and percentage -->
          <text
            x="28"
            y="-2"
            fill="#475569"
            font-size="12"
            font-weight="500"
            class="group-hover:underline"
          >
            {node.name}
          </text>
          <text x="28" y="14" fill="#64748b" font-size="11"
            >{node.percent}%</text
          >
        </g>
      </a>
    {/each}

    <!-- Central node: Computer/Device (Left) -->
    <g transform="translate({startX}, {startY})" class="device-node">
      <!-- Glow around computer -->
      <circle
        cx="0"
        cy="0"
        r="30"
        fill="#8b5cf6"
        opacity="0.15"
        class="animate-pulse"
      />
      <circle
        cx="0"
        cy="0"
        r="24"
        fill="#ffffff"
        stroke="#8b5cf6"
        stroke-width="2"
        class="shadow-xl"
      />
      <!-- Device / lock icon -->
      <svg
        x="-12"
        y="-12"
        width="24"
        height="24"
        fill="none"
        stroke="#8b5cf6"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="11" width="18" height="10" rx="2"></rect>
        <path d="M7 11V7a5 5 0 0110 0v4"></path>
      </svg>
    </g>
  </svg>

  <!-- Total Progress label sticky at the bottom -->
  <div
    class="sticky bottom-0 pb-0 pt-4 self-stretch flex items-center justify-center text-sm z-10 pointer-events-none"
  >
    <div
      class="px-5 py-2 pointer-events-auto bg-white/70 rounded-full border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md flex gap-2 items-center text-slate-600"
    >
      <span class="font-medium text-slate-500"
        >{$_("network.total_progress")}</span
      >
      <span class="text-indigo-600 font-bold">{totalPercent}%</span>
    </div>
  </div>
</div>

<style>
  /* Animation of data flow over the curves */
  .data-flow {
    /* Dash length 4, gap 24 */
    stroke-dasharray: 4 24;
  }

  /* Flow right (forward) */
  .flow-upload {
    animation: flowRight 1.5s linear infinite;
  }

  /* Flow left (backward) */
  .flow-download {
    animation: flowLeft 1.5s linear infinite;
  }

  /* Shift pattern to create illusion of movement */
  @keyframes flowRight {
    from {
      stroke-dashoffset: 28;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes flowLeft {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: 28;
    }
  }

  /* Soft device node hover */
  .device-node {
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
</style>
