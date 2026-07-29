import * as React from "react";
import { cn } from "@/lib/utils";
import { Bold, Italic, Underline, Palette } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const COLORS = [
  { label: "Padrão", value: "" },
  { label: "Vermelho", value: "#dc2626" },
  { label: "Azul", value: "#2563eb" },
  { label: "Verde", value: "#16a34a" },
  { label: "Laranja", value: "#ea580c" },
  { label: "Roxo", value: "#9333ea" },
];

interface SimpleEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const SimpleEditor = React.forwardRef<HTMLDivElement, SimpleEditorProps>(
  ({ value, onChange, placeholder, className }, ref) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const isInternalChange = React.useRef(false);

    React.useImperativeHandle(ref, () => editorRef.current!);

    // Sync external value only when it differs from internal HTML
    React.useEffect(() => {
      if (isInternalChange.current) {
        isInternalChange.current = false;
        return;
      }
      const el = editorRef.current;
      if (el && el.innerHTML !== value) {
        el.innerHTML = value;
      }
    }, [value]);

    const handleInput = () => {
      isInternalChange.current = true;
      onChange(editorRef.current?.innerHTML || "");
    };

    const exec = (command: string, val?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, val);
      handleInput();
    };

    const isEmpty = !value || value === "<br>" || value === "<div><br></div>";

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-0.5 border border-input rounded-t-md bg-muted/50 px-1 py-0.5">
          <Toggle size="sm" aria-label="Negrito" onPressedChange={() => exec("bold")} className="h-8 w-8 p-0">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Itálico" onPressedChange={() => exec("italic")} className="h-8 w-8 p-0">
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" aria-label="Sublinhado" onPressedChange={() => exec("underline")} className="h-8 w-8 p-0">
            <Underline className="h-4 w-4" />
          </Toggle>
          <Popover>
            <PopoverTrigger asChild>
              <button
               type="button"
                className="inline-flex items-center justify-center rounded-md h-8 w-8 text-sm hover:bg-muted transition-colors"
                aria-label="Cor do texto"
              >
                <Palette className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex gap-1">
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c.value || "default"}
                    className="h-6 w-6 rounded-full border border-input transition-transform hover:scale-110"
                    style={{ backgroundColor: c.value || "hsl(var(--foreground))" }}
                    title={c.label}
                    onClick={() => exec("foreColor", c.value || "inherit")}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="relative">
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            className={cn(
              "min-h-[100px] w-full rounded-b-md border border-input border-t-0 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              className
            )}
          />
          {isEmpty && (
            <span className="absolute top-2 left-3 text-sm text-muted-foreground pointer-events-none">
              {placeholder}
            </span>
          )}
        </div>
      </div>
    );
  }
);

SimpleEditor.displayName = "SimpleEditor";

export { SimpleEditor };
