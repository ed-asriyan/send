<script lang="ts">
    interface Props {
        serverName: string;
        percent: number;
    }
    let { serverName, percent }: Props = $props();
</script>

<div class="w-full">
    <div class="flex justify-between text-sm mb-2 text-slate-600">
        <span class="font-mono truncate mr-4">{serverName}</span>
        <span class="font-medium">{percent}%</span>
    </div>
    <div class="w-full bg-black/5 rounded-full h-2 overflow-hidden">
        <div class="bg-indigo-500 h-2 rounded-full transition-all duration-300 ease-out" style="width: {percent}%"></div>
    </div>
</div>