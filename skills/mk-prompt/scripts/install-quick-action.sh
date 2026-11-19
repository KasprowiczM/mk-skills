#!/usr/bin/env bash
# macOS only: install a Services-menu Quick Action that runs structure.sh on the
# selected text and replaces the selection with the result.
# Needs the Claude Code CLI installed and signed in (structure.sh calls it).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STRUCTURE="$SCRIPT_DIR/structure.sh"
SERVICES_DIR="$HOME/Library/Services"
NAME="Ustrukturyzuj prompt"
MODEL=""
FORCE=0
UNINSTALL=0

usage() {
  cat <<USAGE
Usage: install-quick-action.sh [--services-dir <dir>] [--name <service name>] [--model <model>] [--force] [--uninstall]

Builds "<name>.workflow" in the Services folder (default ~/Library/Services),
pointing at the structure.sh next to this script:
  $STRUCTURE
Refuses to overwrite an existing workflow without --force.
--model <model> bakes PROMPT_MASTER_MODEL=<model> into the action (environment
variables from your shell do not reach a Services action). Default: sonnet.
--uninstall removes "<name>.workflow" from the Services folder.
USAGE
}

die() { printf 'error: %s\n' "$*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --services-dir) [ $# -ge 2 ] || die "--services-dir needs a value"; SERVICES_DIR="$2"; shift 2 ;;
    --name)         [ $# -ge 2 ] || die "--name needs a value"; NAME="$2"; shift 2 ;;
    --model)        [ $# -ge 2 ] || die "--model needs a value"; MODEL="$2"; shift 2 ;;
    --force)        FORCE=1; shift ;;
    --uninstall)    UNINSTALL=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    *) usage >&2; die "unknown argument: $1" ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || die "this installer is macOS only"
case "$NAME" in ""|*/*|.*) die "invalid --name: $NAME" ;; esac
case "$MODEL" in *[!A-Za-z0-9._:/\[\]-]*) die "invalid --model: $MODEL" ;; esac

WF="$SERVICES_DIR/$NAME.workflow"

refresh_services() {
  if [ -x /System/Library/CoreServices/pbs ]; then
    /System/Library/CoreServices/pbs -update >/dev/null 2>&1 || echo "note: pbs -update failed; log out and in to refresh the Services menu"
  fi
}

if [ "$UNINSTALL" -eq 1 ]; then
  if [ -e "$WF" ]; then
    rm -rf "$WF"
    echo "removed $WF"
    refresh_services
  else
    echo "nothing to remove: $WF"
  fi
  exit 0
fi

[ -f "$STRUCTURE" ] || die "structure.sh not found next to this script"
if [ -e "$WF" ] && [ "$FORCE" -eq 0 ]; then
  echo "exists: $WF (use --force to replace)"
  exit 1
fi

xml_escape() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
# shell-quote the path for the command line, then XML-escape the whole command
SQ="'"
QUOTED_PATH="$SQ$(printf '%s' "$STRUCTURE" | sed "s/'/'\\\\''/g")$SQ"
CMD="/bin/bash $QUOTED_PATH"
[ -z "$MODEL" ] || CMD="PROMPT_MASTER_MODEL='$MODEL' $CMD"
CMD_XML="$(xml_escape "$CMD")"
NAME_XML="$(xml_escape "$NAME")"
U1="$(uuidgen)"; U2="$(uuidgen)"; U3="$(uuidgen)"

TMP_WF="$SERVICES_DIR/.$NAME.workflow.tmp.$$"
rm -rf "$TMP_WF"
mkdir -p "$TMP_WF/Contents"
trap 'rm -rf "$TMP_WF"' EXIT

cat > "$TMP_WF/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSBackgroundColorName</key>
			<string>background</string>
			<key>NSIconName</key>
			<string>NSActionTemplate</string>
			<key>NSMenuItem</key>
			<dict>
				<key>default</key>
				<string>$NAME_XML</string>
			</dict>
			<key>NSMessage</key>
			<string>runWorkflowAsService</string>
			<key>NSReturnTypes</key>
			<array>
				<string>public.utf8-plain-text</string>
			</array>
			<key>NSSendTypes</key>
			<array>
				<string>public.utf8-plain-text</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
PLIST

cat > "$TMP_WF/Contents/document.wflow" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AMApplicationBuild</key>
	<string>534</string>
	<key>AMApplicationVersion</key>
	<string>2.10</string>
	<key>AMDocumentVersion</key>
	<string>2</string>
	<key>actions</key>
	<array>
		<dict>
			<key>action</key>
			<dict>
				<key>AMAccepts</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Optional</key>
					<true/>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>AMActionVersion</key>
				<string>2.0.3</string>
				<key>AMApplication</key>
				<array>
					<string>Automator</string>
				</array>
				<key>AMParameterProperties</key>
				<dict>
					<key>COMMAND_STRING</key>
					<dict/>
					<key>CheckedForUserDefaultShell</key>
					<dict/>
					<key>inputMethod</key>
					<dict/>
					<key>shell</key>
					<dict/>
					<key>source</key>
					<dict/>
				</dict>
				<key>AMProvides</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>ActionBundlePath</key>
				<string>/System/Library/Automator/Run Shell Script.action</string>
				<key>ActionName</key>
				<string>Run Shell Script</string>
				<key>ActionParameters</key>
				<dict>
					<key>COMMAND_STRING</key>
					<string>$CMD_XML</string>
					<key>CheckedForUserDefaultShell</key>
					<true/>
					<key>inputMethod</key>
					<integer>0</integer>
					<key>shell</key>
					<string>/bin/zsh</string>
					<key>source</key>
					<string></string>
				</dict>
				<key>BundleIdentifier</key>
				<string>com.apple.RunShellScript</string>
				<key>CFBundleVersion</key>
				<string>2.0.3</string>
				<key>CanShowSelectedItemsWhenRun</key>
				<false/>
				<key>CanShowWhenRun</key>
				<true/>
				<key>Category</key>
				<array>
					<string>AMCategoryUtilities</string>
				</array>
				<key>Class Name</key>
				<string>RunShellScriptAction</string>
				<key>InputUUID</key>
				<string>$U1</string>
				<key>Keywords</key>
				<array>
					<string>Shell</string>
					<string>Script</string>
					<string>Command</string>
					<string>Run</string>
					<string>Unix</string>
				</array>
				<key>OutputUUID</key>
				<string>$U2</string>
				<key>UUID</key>
				<string>$U3</string>
				<key>UnlocalizedApplications</key>
				<array>
					<string>Automator</string>
				</array>
				<key>arguments</key>
				<dict>
					<key>0</key>
					<dict>
						<key>default value</key>
						<integer>0</integer>
						<key>name</key>
						<string>inputMethod</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>0</string>
					</dict>
					<key>1</key>
					<dict>
						<key>default value</key>
						<false/>
						<key>name</key>
						<string>CheckedForUserDefaultShell</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>1</string>
					</dict>
					<key>2</key>
					<dict>
						<key>default value</key>
						<string></string>
						<key>name</key>
						<string>source</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>2</string>
					</dict>
					<key>3</key>
					<dict>
						<key>default value</key>
						<string></string>
						<key>name</key>
						<string>COMMAND_STRING</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>3</string>
					</dict>
					<key>4</key>
					<dict>
						<key>default value</key>
						<string>/bin/sh</string>
						<key>name</key>
						<string>shell</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>4</string>
					</dict>
				</dict>
				<key>conversionLabel</key>
				<integer>0</integer>
				<key>isViewVisible</key>
				<integer>1</integer>
				<key>location</key>
				<string>309.000000:305.000000</string>
				<key>nibPath</key>
				<string>/System/Library/Automator/Run Shell Script.action/Contents/Resources/Base.lproj/main.nib</string>
			</dict>
			<key>isViewVisible</key>
			<integer>1</integer>
		</dict>
	</array>
	<key>connectors</key>
	<dict/>
	<key>workflowMetaData</key>
	<dict>
		<key>applicationBundleIDsByPath</key>
		<dict/>
		<key>applicationPaths</key>
		<array/>
		<key>inputTypeIdentifier</key>
		<string>com.apple.Automator.text</string>
		<key>outputTypeIdentifier</key>
		<string>com.apple.Automator.text</string>
		<key>presentationMode</key>
		<integer>11</integer>
		<key>processesInput</key>
		<true/>
		<key>serviceInputTypeIdentifier</key>
		<string>com.apple.Automator.text</string>
		<key>serviceOutputTypeIdentifier</key>
		<string>com.apple.Automator.text</string>
		<key>serviceProcessesInput</key>
		<true/>
		<key>systemImageName</key>
		<string>NSActionTemplate</string>
		<key>useAutomaticInputType</key>
		<false/>
		<key>workflowTypeIdentifier</key>
		<string>com.apple.Automator.servicesMenu</string>
	</dict>
</dict>
</plist>
PLIST

plutil -lint "$TMP_WF/Contents/Info.plist" "$TMP_WF/Contents/document.wflow" >/dev/null || die "generated plist is invalid"

rm -rf "$WF"
mkdir -p "$SERVICES_DIR"
mv "$TMP_WF" "$WF"
echo "installed $WF"
plutil -lint "$WF/Contents/Info.plist" "$WF/Contents/document.wflow"
refresh_services

cat <<TXT

Quick Action "$NAME" now runs:
  $CMD
It needs the Claude Code CLI installed and signed in.
To use it: select text in any app, then open the app menu > Services > "$NAME".
To assign a keyboard shortcut: System Settings > Keyboard > Keyboard Shortcuts >
Services > Text > "$NAME".
If the menu item is missing, log out and in again, or enable it in the same
Services > Text list.
Do not move or delete this skill folder, or reinstall the action afterwards.
TXT
