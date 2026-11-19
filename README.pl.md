# mk-skills

[English](README.md) · [Polski](README.pl.md)

Mała kolekcja skilli dla agentów (foldery z `SKILL.md`) do Claude Code, Codex,
Antigravity i Cursor. Jedno repozytorium, jeden instalator.

## Skille

| Skill | Co robi | Status |
|---|---|---|
| [`mk-orkiestra`](skills/mk-orkiestra/SKILL.md) | Tryb orkiestry: model sesji jest „szefem”, który planuje i zleca pracę tańszym modelom subagentów (drabinka modeli), a potem wyrywkowo sprawdza wyniki. Cel: ta sama jakość przy niższym koszcie. | 0.1.0 |
| [`mk-ustrukturyzuj-prompt`](skills/mk-ustrukturyzuj-prompt/SKILL.md) | Zamienia chaotyczny lub podyktowany tekst w jeden krótki, uporządkowany prompt do przejrzenia przed wysłaniem. Także Quick Action w macOS i skrypt powłoki. | 0.1.0 |

Dodanie skilla to jeden nowy folder w `skills/` i jeden wiersz w tabeli.

## Wymagania

- macOS lub Linux z `bash` (3.2 lub nowszy). Instalator nie potrzebuje niczego
  poza standardowymi narzędziami (`cp`, `awk`, `mkdir`).
- Co najmniej jeden obsługiwany agent: Claude Code (CLI lub zakładka Code w
  aplikacji), Codex (CLI lub aplikacja ChatGPT/Codex), Antigravity (IDE lub
  `agy`), Cursor (IDE lub `cursor-agent`). OpenCode nie jest obsługiwany.
- `mk-ustrukturyzuj-prompt` w czacie działa bez niczego dodatkowego; jego skrypt
  i Quick Action wymagają zainstalowanego i zalogowanego Claude Code CLI
  (Quick Action: macOS).
- `mk-orkiestra` wymaga agenta, który umie uruchamiać subagentów; bez nich
  pracuje sam. Działa tylko na wyraźną prośbę. Delegowanie jest przetestowane w
  Claude Code i Codex, nieprzetestowane w Cursorze i Antigravity.

## Instalacja

```bash
git clone https://github.com/KasprowiczM/mk-skills.git
cd mk-skills
bash install.sh --harness claude --skill all --dry-run   # podgląd
bash install.sh --harness claude --skill all             # instalacja
```

Flagi: `--harness <claude|codex|antigravity|cursor|all>`, `--skill <nazwa|all>`,
`--dry-run` (nic nie zmienia), `--link` (dowiązanie symboliczne do tego
repozytorium zamiast kopii, więc `git pull` aktualizuje skill), `--force`
(zastąp istniejący folder; bez tego istniejący folder jest pomijany).
Instalator wypisuje, co zrobił, i zapisuje to w `~/.mk-skills/manifest`.
Po instalacji uruchom nową sesję.

### Gdzie trafiają skille i jak je wywołać

| Agent | Folder skilli użytkownika | Źródło | Wywołanie | Delegowanie `mk-orkiestra` |
|---|---|---|---|---|
| Claude Code | `~/.claude/skills` | potwierdzone ([docs](https://code.claude.com/docs/en/skills)) | `/mk-orkiestra` lub automatycznie po opisie | przetestowane |
| Codex | `~/.agents/skills` | potwierdzone ([docs](https://learn.chatgpt.com/docs/build-skills)) | `$mk-orkiestra` lub `/skills` (CLI/IDE), `@` w ChatGPT, albo automatycznie | przetestowane |
| Antigravity | `~/.gemini/config/skills` | potwierdzone ([docs](https://antigravity.google/docs/skills)) | `/mk-orkiestra` (aplikacja i CLI), nazwa w wiadomości lub automatycznie | nieprzetestowane |
| Cursor | `~/.cursor/skills` | potwierdzone ([docs](https://cursor.com/docs/skills)) | wpisz `/` w czacie Agenta i wybierz, albo automatycznie | nieprzetestowane |

Ścieżki sprawdzono w oficjalnej dokumentacji 2026-11-19. Dokumentacja się
zmienia; jeśli ścieżka przestanie działać, zgłoś issue. Uwagi:

- Cursor i Antigravity czytają definicje subagentów z osobnych folderów
  (`~/.cursor/agents`, `~/.gemini/config/agents`; dokumentacja:
  [Cursor](https://cursor.com/docs/subagents),
  [Antigravity](https://antigravity.google/docs/subagents)). `install.sh`
  kopiuje tam pomocników `mk-orkiestra` (`skills/mk-orkiestra/helpers/`). Szczegóły w
  [docs/harnesses.md](docs/harnesses.md) (po angielsku).
- Cursor czyta też `~/.agents/skills`, `~/.claude/skills` i `~/.codex/skills`
  (a definicje subagentów także z `~/.claude/agents` i `~/.codex/agents`);
  instaluj w jednym miejscu, żeby uniknąć duplikatów.
- Folder osobistych skilli Claude Code nie jest czytany przez Cowork ani sesje
  w chmurze.

## Użycie

- „Użyj mk-orkiestra: podziel tę migrację na zlecenia dla tańszych modeli i
  sprawdź wyniki.”
- „orkiestra: zleć to subagentom i sprawdź wyniki.”
- „Jesteś szefem, deleguj implementację, trzymaj koszt nisko.”

Przy pierwszym użyciu skill czyta `ladders.toml`, znajduje szczebel Twojego
modelu i deleguje tylko do tańszych szczebli. Drabinki są przykładowe:
sprawdź je względem własnej listy modeli i edytuj (sekcja 9 w
[`SKILL.md`](skills/mk-orkiestra/SKILL.md), po angielsku).

### mk-ustrukturyzuj-prompt

W czacie nie wymaga niczego. Skrypt i Quick Action wymagają zainstalowanego i
zalogowanego Claude Code CLI (`claude`); model zmienisz zmienną
`PROMPT_MASTER_MODEL` (domyślnie `sonnet`; dla Quick Action użyj `--model`). Przy każdym problemie
(brak CLI, błąd, przekroczony czas, pusta odpowiedź) skrypt zwraca Twój tekst
bez zmian.

Przed (podyktowany szkic):

> no to chciałbym taki skrypt, yyy, w pythonie, który przechodzi po wszystkich
> plikach csv w katalogu, nie, w katalogu i podkatalogach, i łączy je w jeden
> plik, i ma usuwać zduplikowane wiersze, a plik wynikowy ma się nazywać
> merged.csv, i żeby nie wywalał się na dużych plikach

Po:

```
## Cel
Połączyć wiele plików CSV w jeden plik bez duplikatów.

## Zadanie
Napisz skrypt w Pythonie, który:
1. Znajduje wszystkie pliki CSV w katalogu i podkatalogach.
2. Łączy je w jeden plik `merged.csv`.
3. Usuwa zduplikowane wiersze.

## Wymagania i ograniczenia
- Ma radzić sobie z dużymi plikami bez wyczerpania pamięci.

## Do doprecyzowania
- Czy wszystkie pliki mają te same kolumny?
```

Trzy sposoby użycia:

1. **W czacie, po nazwie:** „ustrukturyzuj prompt: <Twój szkic>”. Agent odpowiada
   samym uporządkowanym promptem; popraw go, potem powiedz „wykonaj” / "go".
2. **Quick Action w macOS** (zaznacz tekst w dowolnej aplikacji, wynik zastępuje
   zaznaczenie):
   `bash ~/.claude/skills/mk-ustrukturyzuj-prompt/scripts/install-quick-action.sh`
   (uruchom z zainstalowanej kopii, w folderze skilli swojego agenta; akcja
   wskazuje folder, w którym leży skrypt, więc potem go nie przenoś). Flagi:
   `--model <nazwa>` (wpisuje `PROMPT_MASTER_MODEL=<nazwa>` do akcji; zmienne
   środowiskowe z powłoki nie docierają do akcji Usług), `--name`,
   `--services-dir`, `--force`, `--uninstall`. Skrót klawiszowy: Ustawienia
   systemowe > Klawiatura > Skróty klawiszowe > Usługi > Tekst.
   `uninstall.sh` usuwa też Quick Action zainstalowaną z kopii, którą usuwa.
3. **Terminal:** `pbpaste | ~/.claude/skills/mk-ustrukturyzuj-prompt/scripts/structure.sh | pbcopy`

## Aktualizacja

```bash
git pull
bash install.sh --harness <ten, który instalowałeś> --skill all --force   # kopie; przy --link niepotrzebne
# użyj tej samej wartości --harness co przy pierwszej instalacji
```

## Odinstalowanie

```bash
bash uninstall.sh --dry-run
bash uninstall.sh                         # wszyscy agenci, wszystkie skille
bash uninstall.sh --harness claude --skill mk-orkiestra
```

Usuwane jest tylko to, co zapisał `install.sh`.

## FAQ / problemy

- **Skill się nie pojawia.** Uruchom nową sesję (Antigravity CLI: `/skills
  reload`). Sprawdź, czy folder z tabeli istnieje i zawiera
  `mk-orkiestra/SKILL.md`.
- **„skip ... (exists)”.** Cel już istnieje; użyj `--force`, aby zastąpić.
- **Subagent użył modelu szefa i nic nie zaoszczędził.** Agent zignorował wybór
  modelu albo drabinka wskazuje model, którego nie masz na koncie. Porównaj
  `ladders.toml` z własną listą modeli.
- **Nie znajduje pomocników w Antigravity/Cursorze.** Sprawdź, czy pliki są w
  `~/.gemini/config/agents/` / `~/.cursor/agents/`.
- **Czy to bezpieczne?** Skrypty piszą tylko do folderów powyżej i
  `~/.mk-skills`; skille to zwykły tekst. Zobacz [SECURITY.md](SECURITY.md).

## Współpraca, licencja

[CONTRIBUTING.md](CONTRIBUTING.md) · [CHANGELOG.md](CHANGELOG.md) · MIT, zobacz [LICENSE](LICENSE).
