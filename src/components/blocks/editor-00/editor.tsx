import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { $getRoot } from "lexical";

import { TooltipProvider } from "@/components/ui/tooltip";
import { editorTheme } from "@/components/editor/themes/editor-theme";

import { nodes } from "./nodes";
import { Plugins } from "./plugins";

const editorConfig = {
  namespace: "ScopeDescriptionEditor",
  theme: editorTheme,
  nodes,
  onError: (error) => {
    console.error(error);
  },
};

export function Editor({ editorSerializedState, onSerializedChange, onPlainTextChange }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <LexicalComposer
        initialConfig={{
          ...editorConfig,
          ...(editorSerializedState ? { editorState: JSON.stringify(editorSerializedState) } : {}),
        }}>
        <TooltipProvider>
          <Plugins />
          <OnChangePlugin
            ignoreSelectionChange
            onChange={(editorState) => {
              onSerializedChange?.(editorState.toJSON());
              if (onPlainTextChange) {
                editorState.read(() => {
                  onPlainTextChange($getRoot().getTextContent());
                });
              }
            }}
          />
        </TooltipProvider>
      </LexicalComposer>
    </div>
  );
}
