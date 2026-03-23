import "./editor-theme.css";

export const editorTheme = {
  ltr: "text-left",
  rtl: "text-right",
  heading: {
    h1: "text-3xl font-bold",
    h2: "text-2xl font-semibold",
    h3: "text-xl font-semibold",
    h4: "text-lg font-semibold",
    h5: "text-base font-semibold",
    h6: "text-sm font-semibold",
  },
  paragraph: "leading-6",
  quote: "mt-3 border-l-2 pl-4 italic",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
  },
  list: {
    ul: "list-disc ml-5",
    ol: "list-decimal ml-5",
    listitem: "my-1",
  },
};
