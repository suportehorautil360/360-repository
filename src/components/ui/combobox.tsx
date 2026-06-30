import * as React from "react";
import { CheckIcon, ChevronDownIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Termos extras de busca (ex.: chassi, placa) além do label. */
  keywords?: string[];
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Classe do gatilho (ex.: `ft-select-trigger w-full`). */
  className?: string;
  /** Classe do popover (ex.: `z-[70]` quando dentro de um modal). */
  contentClassName?: string;
  inlineSearch?: boolean;
}

/**
 * Select com busca (Radix Popover + cmdk), no padrão do design system.
 * Use para listas longas/buscáveis; o `Select` continua para listas curtas.
 */
const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nada encontrado.",
  disabled,
  className,
  contentClassName,
  inlineSearch = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [busca, setBusca] = React.useState("");
  const selected = options.find((o) => o.value === value);

  const filtradas = React.useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return options;
    return options.filter((o) =>
      normalizar(`${o.label} ${(o.keywords ?? []).join(" ")}`).includes(q),
    );
  }, [options, busca]);

  function handleOpenChange(aberto: boolean) {
    setOpen(aberto);
    if (!aberto) setBusca("");
  }

  if (inlineSearch) {
    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverAnchor asChild>
          <div
            role="combobox"
            aria-expanded={open}
            onClick={() => { if (!open && !disabled) { setBusca(""); setOpen(true); } }}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
              disabled && "cursor-not-allowed opacity-50",
              className,
            )}
          >
            {open ? (
              <input
                autoFocus
                type="text"
                style={{ border: "none", background: "transparent", padding: 0, outline: "none", boxShadow: "none", borderRadius: 0 }}
                className="min-w-0 flex-1 cursor-text placeholder:opacity-60"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder={placeholder}
                disabled={disabled}
              />
            ) : (
              <span className={cn("min-w-0 flex-1 truncate", !selected && "opacity-60")}>
                {selected ? selected.label : placeholder}
              </span>
            )}
            <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "w-(--radix-popover-anchor-width) p-0",
            contentClassName,
          )}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {filtradas.length === 0 ? (
                <div className="text-muted-foreground py-6 text-center text-sm">
                  {emptyText}
                </div>
              ) : (
                <CommandGroup>
                  {filtradas.map((o) => (
                    <CommandItem
                      key={o.value}
                      value={o.value}
                      onSelect={() => {
                        onValueChange(o.value);
                        setOpen(false);
                        setBusca("");
                      }}
                    >
                      <CheckIcon
                        className={cn(
                          "size-4 shrink-0",
                          value === o.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{o.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "opacity-60")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-(--radix-popover-trigger-width) p-0",
          contentClassName,
        )}
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={busca}
            onValueChange={setBusca}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            {filtradas.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-sm">
                {emptyText}
              </div>
            ) : (
              <CommandGroup>
                {filtradas.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  keywords={o.keywords}
                  onSelect={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      value === o.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
