// ⚠ Copia de shared/spell/nspell.d.ts: edita el original y ejecuta node scripts/sync-shared.mjs
declare module "nspell" {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): NSpell;
  }
  export default function nspell(aff: string, dic: string): NSpell;
}
