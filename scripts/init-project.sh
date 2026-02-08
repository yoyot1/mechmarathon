#!/bin/bash
#
# init-project.sh - Bootstrap a new project with Claude Code
#
# This script launches Claude Code in planning mode to help configure
# the development environment and project structure.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Project Initialization with Claude Code           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo

# Check if claude is available
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: Claude Code CLI not found.${NC}"
    echo "Please ensure Claude Code is installed in the dev container."
    exit 1
fi

# Check if CLAUDE.md exists
if [ ! -f "$PROJECT_ROOT/CLAUDE.md" ]; then
    echo -e "${RED}Error: CLAUDE.md not found in project root.${NC}"
    exit 1
fi

# Optional: Get project name from user
echo -e "${YELLOW}Enter a name for your project (or press Enter to decide during planning):${NC}"
read -r PROJECT_NAME

# Build the initial prompt
INIT_PROMPT="I'm starting a new project using this template. Let's work in planning mode to:

1. First, ask me about the project requirements - what I'm building, constraints, preferences
2. Based on my answers, recommend a tech stack
3. Update .devcontainer/devcontainer.json with the necessary features (reference docs/devcontainer-features.md)
4. Set up the git configuration and optionally create a GitHub remote
5. Create the initial project structure and files
6. Update CLAUDE.md with project-specific documentation

Please start by asking me about the project."

# Add project name to prompt if provided
if [ -n "$PROJECT_NAME" ]; then
    INIT_PROMPT="The project is called '$PROJECT_NAME'. $INIT_PROMPT"
fi

echo
echo -e "${GREEN}Launching Claude Code in planning mode...${NC}"
echo -e "${YELLOW}Tip: Claude will guide you through the setup process.${NC}"
echo

# Change to project root and launch claude
cd "$PROJECT_ROOT"

# Launch Claude Code
# The prompt instructs Claude to use planning mode behavior
exec claude --dangerously-skip-permissions "$INIT_PROMPT"
