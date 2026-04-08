import { useState } from "react"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { $setBlocksType } from "@lexical/selection"
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text"
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import { Bold, Heading2, Italic, Quote, Redo2, Strikethrough, Type, Underline, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button"
import { ContentEditable } from "@/components/editor/editor-ui/content-editable"

function Toolbar() {
  const [editor] = useLexicalComposerContext()

  function formatBlock(type) {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      if (type === "paragraph") {
        $setBlocksType(selection, () => $createParagraphNode())
        return
      }

      if (type === "heading") {
        $setBlocksType(selection, () => $createHeadingNode("h2"))
        return
      }

      if (type === "quote") {
        $setBlocksType(selection, () => $createQuoteNode())
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-2">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
        <Undo2 className="h-4 w-4" />
        <span className="sr-only">Undo</span>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
        <Redo2 className="h-4 w-4" />
        <span className="sr-only">Redo</span>
      </Button>
      <div className="mx-1 h-6 w-px bg-border" />
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}>
        <Bold className="h-4 w-4" />
        <span className="sr-only">Bold</span>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}>
        <Italic className="h-4 w-4" />
        <span className="sr-only">Italic</span>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}>
        <Underline className="h-4 w-4" />
        <span className="sr-only">Underline</span>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}>
        <Strikethrough className="h-4 w-4" />
        <span className="sr-only">Strike</span>
      </Button>
      <div className="mx-1 h-6 w-px bg-border" />
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => formatBlock("paragraph")}>
        <Type className="h-4 w-4" />
        <span className="sr-only">Paragraph</span>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => formatBlock("heading")}>
        <Heading2 className="h-4 w-4" />
        <span className="sr-only">Heading</span>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => formatBlock("quote")}>
        <Quote className="h-4 w-4" />
        <span className="sr-only">Quote</span>
      </Button>
    </div>
  )
}

export function Plugins({ contentClassName = "" }) {
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState(null)

  const onRef = (_floatingAnchorElem) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem)
    }
  }

  return (
    <div className="relative">
      <Toolbar />
      <HistoryPlugin />
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <div className={`bg-background ${contentClassName}`.trim()}>
              <div className="" ref={onRef}>
                <ContentEditable placeholder={"Start typing ..."} />
              </div>
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary} />
      </div>
    </div>
  );
}
