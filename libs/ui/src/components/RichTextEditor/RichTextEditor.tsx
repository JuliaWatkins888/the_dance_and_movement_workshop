import { useId } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FieldShell } from '../FieldShell/FieldShell';
import { IconButton } from '../IconButton/IconButton';
import { Box } from '../Box/Box';
import { mergeClassNames } from '../../theme/mergeClassNames';
import { resolveFieldColorClasses } from '../../utils/resolveFieldColorClasses';
import type { ColorSpec } from '../../contracts/color.contract';
import type { FieldProps } from '../../tokens/field';
import type { IconName } from '../../tokens/icon';

export interface RichTextEditorProps extends FieldProps {
  readonly value: string;
  readonly onChange: (html: string) => void;
  readonly color?: ColorSpec;
  readonly placeholder?: string;
  readonly className?: string;
}

// Prose styling is hand-rolled here (rather than pulling in @tailwindcss/typography, which isn't
// installed and isn't needed for the small set of tags StarterKit + this toolbar can actually
// produce) - kept in sync with the sanitizer's own allowlist in
// libs/api-core/src/schemas/policy.schema.ts.
const CONTENT_CLASSES =
  '[&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_li]:mb-1 [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-surface-300 [&_blockquote]:pl-3 [&_blockquote]:italic ' +
  '[&_a]:text-primary-600 [&_a]:underline [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold';

interface ToolbarButtonSpec {
  readonly icon: IconName;
  readonly label: string;
  readonly isActive: boolean;
  readonly onClick: () => void;
}

// Read once as the editor's initial content, not live-resynced on every `value` change - every
// current consumer (PolicyItemEditDialog) remounts a fresh dialog instance per open via
// dialog.show(), the same "new instance per open" precedent StaffEditDialog's own plain useState
// fields rely on, so there's no existing-instance-reuse case this needs to handle.
export const RichTextEditor = ({
  value,
  onChange,
  color,
  placeholder,
  label,
  required,
  disabled,
  error,
  helperText,
  className,
}: RichTextEditorProps) => {
  const autoId = useId();
  const helperTextId = helperText !== undefined ? `${autoId}-helper` : undefined;
  // Only the static border color is used from resolveFieldColorClasses - its `focusRing` targets
  // the focused element itself via focus-visible:..., which doesn't apply here since the actual
  // focusable element is Tiptap's own inner contenteditable, not this wrapper.
  const { border } = resolveFieldColorClasses(color, error);

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: false } })],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => onChange(updatedEditor.getHTML()),
    editorProps: {
      attributes: {
        class:
          mergeClassNames(
            'min-h-32 w-full rounded-b-md bg-transparent px-3 py-2 text-sm text-surface-900',
            'focus-visible:outline-none',
            CONTENT_CLASSES,
          ) ?? '',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
  });

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = (editor.getAttributes('link')['href'] as string | undefined) ?? '';
    const url = window.prompt('Link URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const toolbarButtons: ToolbarButtonSpec[] = [
    { icon: 'TextB', label: 'Bold', isActive: editor.isActive('bold'), onClick: () => editor.chain().focus().toggleBold().run() },
    {
      icon: 'TextItalic',
      label: 'Italic',
      isActive: editor.isActive('italic'),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: 'TextUnderline',
      label: 'Underline',
      isActive: editor.isActive('underline'),
      onClick: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      icon: 'ListBullets',
      label: 'Bullet list',
      isActive: editor.isActive('bulletList'),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: 'ListNumbers',
      label: 'Numbered list',
      isActive: editor.isActive('orderedList'),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    { icon: 'LinkSimple', label: 'Link', isActive: editor.isActive('link'), onClick: setLink },
  ];

  return (
    <FieldShell label={label} required={required} error={error} helperText={helperText} helperTextId={helperTextId}>
      <div className={mergeClassNames('w-full overflow-hidden rounded-md border', border, className)}>
        <Box
          flex={{ direction: 'row', align: 'center', gap: 2 }}
          borderColor={{ color: 'surface', intensity: 200 }}
          padding={{ base: 4 }}
          className="flex-wrap border-b"
        >
          {toolbarButtons.map((button) => (
            <IconButton
              key={button.label}
              icon={button.icon}
              label={button.label}
              iconSize={16}
              disabled={disabled}
              variant={button.isActive ? { kind: 'filled', color: 'primary', intensity: 500 } : { kind: 'ghost', color: 'surface' }}
              onClick={button.onClick}
            />
          ))}
        </Box>
        <EditorContent editor={editor} />
      </div>
    </FieldShell>
  );
};
