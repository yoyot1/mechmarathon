# Dev Container Features Reference

This document lists commonly used dev container features for quick reference during project setup.

## How to Use

Add features to `.devcontainer/devcontainer.json` in the `features` object:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "20"
    }
  }
}
```

After modifying, rebuild the container: `Ctrl+Shift+P` → "Dev Containers: Rebuild Container"

---

## Languages & Runtimes

### Node.js / JavaScript / TypeScript
```json
"ghcr.io/devcontainers/features/node:1": {
  "version": "20",
  "nodeGypDependencies": true
}
```

### Python
```json
"ghcr.io/devcontainers/features/python:1": {
  "version": "3.12",
  "installTools": true
}
```

### Java
```json
"ghcr.io/devcontainers/features/java:1": {
  "version": "21",
  "installMaven": true,
  "installGradle": true
}
```

### Go
```json
"ghcr.io/devcontainers/features/go:1": {
  "version": "1.22"
}
```

### Rust
```json
"ghcr.io/devcontainers/features/rust:1": {
  "version": "latest"
}
```

### .NET
```json
"ghcr.io/devcontainers/features/dotnet:1": {
  "version": "8.0"
}
```

### Ruby
```json
"ghcr.io/devcontainers/features/ruby:1": {
  "version": "3.3"
}
```

### PHP
```json
"ghcr.io/devcontainers/features/php:1": {
  "version": "8.3"
}
```

---

## Databases & Data Tools

### PostgreSQL Client
```json
"ghcr.io/robbert229/devcontainer-features/postgresql-client:1": {}
```

### SQL Server Tools (sqlcmd, etc.)
```json
"ghcr.io/devcontainers/features/dotnet:1": {}
```
Then add to `postCreateCommand`:
```bash
"postCreateCommand": "dotnet tool install -g microsoft-sqlcmd"
```

### Redis Tools
```json
"ghcr.io/itsmechlark/features/redis:1": {}
```

### MongoDB Shell
Add to `postCreateCommand`:
```bash
"postCreateCommand": "curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor && echo 'deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse' | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list && sudo apt-get update && sudo apt-get install -y mongodb-mongosh"
```

---

## Infrastructure & DevOps

### Docker-in-Docker
```json
"ghcr.io/devcontainers/features/docker-in-docker:1": {
  "dockerDashComposeVersion": "v2"
}
```

### Docker-outside-of-Docker (uses host Docker)
```json
"ghcr.io/devcontainers/features/docker-outside-of-docker:1": {}
```

### Kubernetes Tools (kubectl, Helm, minikube)
```json
"ghcr.io/devcontainers/features/kubectl-helm-minikube:1": {}
```

### Terraform
```json
"ghcr.io/devcontainers/features/terraform:1": {
  "version": "latest"
}
```

### AWS CLI
```json
"ghcr.io/devcontainers/features/aws-cli:1": {}
```

### Azure CLI
```json
"ghcr.io/devcontainers/features/azure-cli:1": {}
```

### Google Cloud CLI
```json
"ghcr.io/devcontainers/features/gcloud:1": {}
```

---

## Development Tools

### Common Utilities (jq, curl, wget, etc.)
```json
"ghcr.io/devcontainers/features/common-utils:1": {
  "installZsh": true,
  "configureZshAsDefaultShell": false
}
```

### GitHub CLI (already in base template)
```json
"ghcr.io/devcontainers/features/github-cli:1": {}
```

### GitLab CLI
```json
"ghcr.io/devcontainers-contrib/features/glab:1": {}
```

### SOPS (Secrets management)
```json
"ghcr.io/devcontainers-contrib/features/sops:1": {}
```

### Starship Prompt
```json
"ghcr.io/devcontainers/features/starship:1": {}
```

---

## Web Development

### Nginx
```json
"ghcr.io/devcontainers-contrib/features/nginx:1": {}
```

### Hugo (Static Site Generator)
```json
"ghcr.io/devcontainers/features/hugo:1": {}
```

---

## VS Code Extensions by Stack

Add these to the `customizations.vscode.extensions` array:

### JavaScript/TypeScript
```json
"dbaeumer.vscode-eslint",
"esbenp.prettier-vscode",
"bradlc.vscode-tailwindcss"
```

### Python
```json
"ms-python.python",
"ms-python.vscode-pylance",
"ms-python.black-formatter",
"charliermarsh.ruff"
```

### Java
```json
"vscjava.vscode-java-pack",
"vmware.vscode-spring-boot"
```

### Go
```json
"golang.go"
```

### Rust
```json
"rust-lang.rust-analyzer"
```

### Database
```json
"ms-mssql.mssql",
"ckolkman.vscode-postgres",
"mongodb.mongodb-vscode"
```

### Docker/Kubernetes
```json
"ms-azuretools.vscode-docker",
"ms-kubernetes-tools.vscode-kubernetes-tools"
```

---

## Example: Full-Stack Node.js + PostgreSQL

```json
{
  "name": "Full-Stack Node",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {},
    "ghcr.io/anthropics/devcontainer-features/claude-code:1": {},
    "ghcr.io/devcontainers/features/node:1": {
      "version": "20"
    },
    "ghcr.io/devcontainers/features/docker-in-docker:1": {}
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "anthropics.claude-code",
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ckolkman.vscode-postgres"
      ]
    }
  },
  "postCreateCommand": "npm install -g pnpm",
  "remoteUser": "vscode"
}
```

## Example: Python Data Science

```json
{
  "name": "Python Data Science",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {},
    "ghcr.io/anthropics/devcontainer-features/claude-code:1": {},
    "ghcr.io/devcontainers/features/python:1": {
      "version": "3.12"
    }
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "anthropics.claude-code",
        "ms-python.python",
        "ms-python.vscode-pylance",
        "ms-toolsai.jupyter"
      ]
    }
  },
  "postCreateCommand": "pip install --upgrade pip && pip install poetry",
  "remoteUser": "vscode"
}
```

## Example: Java Spring Boot

```json
{
  "name": "Java Spring Boot",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {},
    "ghcr.io/anthropics/devcontainer-features/claude-code:1": {},
    "ghcr.io/devcontainers/features/java:1": {
      "version": "21",
      "installMaven": true
    },
    "ghcr.io/devcontainers/features/docker-in-docker:1": {}
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "anthropics.claude-code",
        "vscjava.vscode-java-pack",
        "vmware.vscode-spring-boot"
      ]
    }
  },
  "remoteUser": "vscode"
}
```

---

## Finding More Features

- **Official features**: https://github.com/devcontainers/features
- **Community features**: https://github.com/devcontainers-contrib/features
- **Search all features**: https://containers.dev/features
