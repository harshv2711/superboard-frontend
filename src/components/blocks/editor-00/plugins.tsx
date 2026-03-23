import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";

import { ContentEditable } from "@/components/editor/editor-ui/content-editable";

export function Plugins() {
  return (
    <div className="relative">
      <RichTextPlugin
        contentEditable={<ContentEditable placeholder="Start typing description..." />}
        ErrorBoundary={LexicalErrorBoundary}
      />
    </div>
  );
}
