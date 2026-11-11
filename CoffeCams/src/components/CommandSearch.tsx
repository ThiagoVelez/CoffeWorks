import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { MenuDefinition } from "./SuiteHeader";

interface CommandSearchProps {
  isOpen: boolean;
  onClose: () => void;
  menus: MenuDefinition[];
}

interface Command {
  label: string;
  menu: string;
  shortcut?: string;
  action: () => void;
}

const normalize = (text: string) =>
  text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Buscador de comandos: localiza y ejecuta cualquier opción de los menús. */
export const CommandSearch: React.FC<CommandSearchProps> = ({ isOpen, onClose, menus }) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const all: Command[] = [];
    for (const menu of menus) {
      for (const item of menu.items) {
        if ("divider" in item || !item.action || item.disabled) continue;
        all.push({ label: item.label, menu: menu.label, shortcut: item.shortcut, action: item.action });
      }
    }
    return all;
  }, [menus]);

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return commands;
    return commands.filter((c) => normalize(`${c.label} ${c.menu}`).includes(needle));
  }, [commands, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelected(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!isOpen) return null;

  const runCommand = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    // Se ejecuta tras cerrar para que el foco vuelva antes al documento
    window.setTimeout(command.action, 0);
  };

  return (
    <div
      className="fixed inset-0 z-[999990] bg-black/30 flex items-start justify-center pt-24 select-none print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#dadce0] overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#e8eaed]">
          <Search size={16} className="text-[#444746] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(results.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runCommand(results[selected]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            placeholder="Buscar en los menús…"
            className="flex-1 bg-transparent text-sm text-[#1f1f1f] placeholder:text-[#9aa0a6] outline-none select-text"
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#f1f3f4] text-[#5f6368]">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#747775]">
              Ninguna opción coincide con «{query}».
            </div>
          ) : (
            results.map((command, index) => (
              <button
                key={`${command.menu}-${command.label}-${index}`}
                type="button"
                data-index={index}
                onMouseEnter={() => setSelected(index)}
                onClick={() => runCommand(command)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-xs ${
                  index === selected ? "bg-[#e8f0fe] text-[#041e49]" : "text-[#1f1f1f]"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{command.label}</span>
                  <span className="text-[10px] text-[#747775] shrink-0">{command.menu}</span>
                </span>
                {command.shortcut && (
                  <span className="font-mono text-[10px] text-[#747775] shrink-0">{command.shortcut}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
