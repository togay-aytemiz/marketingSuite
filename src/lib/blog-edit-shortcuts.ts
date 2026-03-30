export type BlogEditShortcutInput = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
};

export function shouldApplyBlogEditShortcut(input: BlogEditShortcutInput) {
  return (
    input.key === 'Enter' &&
    (Boolean(input.metaKey) || Boolean(input.ctrlKey)) &&
    !input.shiftKey &&
    !input.altKey &&
    !input.isComposing
  );
}
