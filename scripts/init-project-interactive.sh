#!/bin/bash
#
# init-project-interactive.sh - Alternative initialization with more control
#
# Use this if you want to pre-fill some information before launching Claude Code
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Interactive Project Initialization                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo

# Gather basic info before launching Claude
echo -e "${CYAN}Let's gather some basic information first...${NC}"
echo

# Project name
echo -e "${YELLOW}Project name:${NC}"
read -r PROJECT_NAME
echo

# Project type
echo -e "${YELLOW}What type of project? (e.g., web app, API, CLI tool, library):${NC}"
read -r PROJECT_TYPE
echo

# Primary language/framework preference
echo -e "${YELLOW}Any language/framework preference? (or press Enter for no preference):${NC}"
read -r TECH_PREF
echo

# Brief description
echo -e "${YELLOW}Brief description of what you're building:${NC}"
read -r PROJECT_DESC
echo

# GitHub setup
echo -e "${YELLOW}Create GitHub repository? (y/n):${NC}"
read -r CREATE_GITHUB
echo

GITHUB_INSTRUCTION=""
if [[ "$CREATE_GITHUB" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Repository visibility (public/private):${NC}"
    read -r REPO_VISIBILITY
    GITHUB_INSTRUCTION="Please create a GitHub repository with visibility: $REPO_VISIBILITY"
fi

# Build the prompt with collected info
INIT_PROMPT="I'm initializing a new project with the following details:

**Project Name:** $PROJECT_NAME
**Project Type:** $PROJECT_TYPE
**Description:** $PROJECT_DESC"

if [ -n "$TECH_PREF" ]; then
    INIT_PROMPT="$INIT_PROMPT
**Tech Preference:** $TECH_PREF"
fi

if [ -n "$GITHUB_INSTRUCTION" ]; then
    INIT_PROMPT="$INIT_PROMPT
**GitHub:** $GITHUB_INSTRUCTION"
fi

INIT_PROMPT="$INIT_PROMPT

Based on this information, let's work through the setup:

1. Ask any clarifying questions about requirements
2. Recommend and confirm the tech stack
3. Update .devcontainer/devcontainer.json with necessary features
4. Set up git and GitHub if requested
5. Create the initial project structure
6. Update CLAUDE.md with project-specific documentation

Let's start - do you have any questions about the requirements, or shall we proceed with tech stack recommendations?"

# Update CLAUDE.md with the project name
if [ -n "$PROJECT_NAME" ]; then
    sed -i "s/\[PROJECT_NAME\]/$PROJECT_NAME/g" "$PROJECT_ROOT/CLAUDE.md"
fi

echo
echo -e "${GREEN}Information collected. Launching Claude Code...${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

cd "$PROJECT_ROOT"
exec claude --dangerously-skip-permissions "$INIT_PROMPT"
