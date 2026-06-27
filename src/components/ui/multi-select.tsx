import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Termos extras de busca (ex.: CPF, matrícula) além do label. */
  keywords?: string[];
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Classe do gatilho (ex.: tema escuro do formulário). */
  className?: string;
  /** Classe do popover (ex.: `z-[70]` quando dentro de um modal). */
  contentClassName?: string;
}

/**
 * Seleção múltipla com busca (Radix Popover + cmdk), no padrão do design
 * system — irmão do `Combobox`, mas com `value: string[]` e chips removíveis.
 */
const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nada encontrado.",
  disabled,
  className,
  contentClassName,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [busca, setBusca] = React.useState("");

  const selecionadas = options.filter((o) => value.includes(o.value));

  // Filtra manualmente (substring em label + keywords); o `value` do item é um id.
  const filtradas = React.useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return options;
    return options.filter((o) =>
      normalizar(`${o.label} ${(o.keywords ?? []).join(" ")}`).includes(q),
    );
  }, [options, busca]);

  function alternar(v: string) {
    onValueChange(
      value.includes(v) ? value.filter((x) => x !== v) : [...value, v],
    );
  }

  function remover(v: string, e: React.MouseEvent) {
    e.stopPropagation();
    onValueChange(value.filter((x) => x !== v));
  }

  function handleOpenChange(aberto: boolean) {
    setOpen(aberto);
    if (!aberto) setBusca("");
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
            "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="flex flex-1 flex-wrap gap-1 text-left">
            {selecionadas.length === 0 ? (
              <span className="opacity-60">{placeholder}</span>
            ) : (
              selecionadas.map((o) => (
                <Badge
                  key={o.value}
                  className="cursor-pointer"
                  onClick={(e) => remover(o.value, e)}
                >
                  {o.label}
                  <XIcon className="size-3 shrink-0 opacity-70" aria-hidden />
                </Badge>
              ))
            )}
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
                    onSelect={() => alternar(o.value)}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4 shrink-0",
                        value.includes(o.value) ? "opacity-100" : "opacity-0",
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
