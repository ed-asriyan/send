<script lang="ts">
  let { text, class: className = "" } = $props();
</script>

<div class="truncate max-w-full {className}" title={text}>
  {text}
</div>
