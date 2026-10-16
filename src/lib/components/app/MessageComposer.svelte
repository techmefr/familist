<script lang="ts">
 import { ImagePlus, Plus, Send } from '@lucide/svelte';
 import { Input } from '$components/ui/input';
 import { Button } from '$components/ui/button';
 import { t } from '$i18n/index.svelte';
 let { value = $bindable(''), prefix, onsubmit, onPhoto, onMore }: {
  value: string;
  prefix: 'chat' | 'direct';
  onsubmit: (event: SubmitEvent) => void | Promise<void>;
  onPhoto: () => void;
  onMore?: () => void;
 } = $props();
</script>

<form {onsubmit} class="fl-message-composer mt-4" data-test-id="{prefix}-form" data-composer>
 <button type="button" onclick={onPhoto} aria-label={t('chat.composePhoto')} data-test-id="{prefix}-photo-open" class="fl-composer-attachment fl-press"><ImagePlus size={20} aria-hidden="true" /></button>
 <Input bind:value aria-label={t('chat.messageLabel')} placeholder={t('chat.placeholder')} data-test-id="{prefix}-input" class="fl-composer-input" enterkeyhint="send" autocomplete="off" required />
 <Button type="submit" class="fl-composer-send shrink-0" data-test-id="{prefix}-send" aria-label={t('chat.send')} onpointerdown={event => event.preventDefault()}><Send size={20} aria-hidden="true" /></Button>
 {#if onMore}<button type="button" onclick={onMore} aria-haspopup="dialog" aria-label={t('chat.composeOpen')} data-test-id="chat-compose-open" class="fl-composer-more fl-press"><Plus size={20} aria-hidden="true" /></button>{/if}
</form>
