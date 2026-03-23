import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";

export function ContentEditable({ placeholder, className, placeholderClassName }) {
  return (
    <LexicalContentEditable
      className={
        className ||
        "ContentEditable__root relative block min-h-28 overflow-auto px-3 py-2 text-sm focus:outline-none"
      }
      aria-placeholder={placeholder}
      placeholder={
        <div
          className={
            placeholderClassName ||
            "text-muted-foreground pointer-events-none absolute top-0 left-0 overflow-hidden px-3 py-2 text-sm select-none"
          }>
          {placeholder}
        </div>
      }
    />
  );
}
