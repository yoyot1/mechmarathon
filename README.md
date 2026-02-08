# Project Template for Claude Code Development

A minimal, extensible template for bootstrapping new projects with Claude Code in VS Code dev containers.

## Prerequisites (One-Time Host Setup)

### GitHub CLI - VS Code Credential Forwarding

VS Code automatically forwards GitHub credentials from your host machine into dev containers. To use this:

1. Install the [GitHub Pull Requests and Issues](https://marketplace.visualstudio.com/items?itemName=GitHub.vscode-pull-request-github) extension on your **host** VS Code
2. Sign in to GitHub through VS Code (click the Accounts icon in the sidebar)

That's it - `gh` commands inside the container will use your host credentials automatically. No tokens or config files are exposed to the container.

**To verify it's working** (inside the container):
```bash
gh auth status
```

### Claude Code - OAuth Login

Run `claude auth login` inside the container after it starts. The dev container includes a workaround (`NODE_OPTIONS=--dns-result-order=ipv4first`) that fixes the OAuth callback issue.

```bash
claude auth login
```

This opens a browser for OAuth. Credentials are stored inside the container and persist until it's rebuilt.

**Note:** You'll need to re-authenticate after rebuilding the container. If you want credentials to persist across rebuilds, you can add a mount for `~/.claude`:

```json
"mounts": [
  "source=${localEnv:HOME}/.claude,target=/home/vscode/.claude,type=bind,consistency=cached"
]
```

## Quick Start

### Creating a New Project

```bash
# Clone the template (without creating a GitHub repo yet)
gh repo clone YOUR_USERNAME/project-template my-new-project
cd my-new-project

# Remove the template's git history and start fresh
rm -rf .git
git init

# Open in VS Code and start the dev container
code .
# Then: Ctrl+Shift+P -> "Dev Containers: Reopen in Container"
```

The init script will offer to create a GitHub repo for you during project setup.

### Initialize Your Project

Once the dev container is running, choose one of two initialization scripts:

```bash
# Option 1: Simple - just launches Claude Code to start planning
./scripts/init-project.sh

# Option 2: Interactive - gathers basic info first, then launches Claude Code
./scripts/init-project-interactive.sh
```

**`init-project.sh`** - Minimal launcher. Opens Claude Code with a prompt to begin the planning conversation from scratch. Use this when you want maximum flexibility or aren't sure yet what you're building.

**`init-project-interactive.sh`** - Asks you a few questions first (project name, type, description, tech preferences, GitHub setup), then passes that context to Claude Code. Use this when you have a clear idea of what you want and want to skip some back-and-forth.

Both scripts launch Claude Code to help you:
1. Define your project requirements
2. Select the appropriate tech stack
3. Configure the dev container with needed tools
4. Set up git and optionally create a GitHub remote
5. Generate project structure and initial files
6. Update CLAUDE.md with project-specific guidance

## What's Included

```
.
├── .devcontainer/
│   └── devcontainer.json          # Container config (mounts ~/.claude for auth)
├── .vscode/
│   └── settings.json              # Basic editor settings
├── CLAUDE.md                       # Project specification template
├── scripts/
│   ├── init-project.sh            # Simple initialization script
│   └── init-project-interactive.sh # Interactive initialization (gathers info first)
├── docs/
│   └── devcontainer-features.md   # Reference catalog for dev container features
└── README.md                       # This file
```

## Philosophy

- **Start minimal**: The base container only includes git, GitHub CLI, and Claude Code
- **Grow as needed**: Add dev container features based on actual project requirements
- **CLAUDE.md is central**: It serves as both project spec and AI guidance
- **Repeatable**: Same workflow regardless of tech stack

## Customizing the Template

Feel free to modify this template for your common needs:
- Add frequently-used dev container features to the base
- Extend the CLAUDE.md template with your preferred sections
- Add shell aliases or tools to postCreateCommand
- Include your preferred editor settings in .vscode/

## License

MIT - Use however you like.
