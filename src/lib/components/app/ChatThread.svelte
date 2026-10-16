<script lang="ts">
 import { onMount, tick, type Snippet } from 'svelte';
 let { revision, label, children }: { revision: string; label: string; children: Snippet } = $props();
 let viewport = $state<HTMLDivElement | null>(null);
 let content = $state<HTMLDivElement | null>(null);
 let following = true;
 const scrollToLatest = () => { if (following && viewport) viewport.scrollTop = viewport.scrollHeight; };
 function scrolled() { if (!viewport) return; following = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 48; }
 $effect(() => {
  void revision;
  let active = true;
  void tick().then(() => { if (active) scrollToLatest(); });
  return () => { active = false; };
 });
 onMount(() => {
  const observer = new ResizeObserver(scrollToLatest);
  if (content) observer.observe(content);
  scrollToLatest();
  return () => observer.disconnect();
 });
</script>

<div bind:this={viewport} class="fl-chat-thread mt-4" role="region" aria-label={label} tabindex="0" onscroll={scrolled} data-test-class="chat-thread">
 <div bind:this={content}>{@render children()}</div>
</div>
