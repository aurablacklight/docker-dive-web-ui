#!/bin/bash

# Docker Environment Setup for Local Development
echo "🔧 Setting up Docker build environment..."

# Create local Docker config if it doesn't exist
mkdir -p ~/.docker

# Add BuildX configuration to shell profile
SHELL_RC=""
if [ -f ~/.bashrc ]; then
    SHELL_RC="$HOME/.bashrc"
elif [ -f ~/.zshrc ]; then
    SHELL_RC="$HOME/.zshrc"
fi

if [ -n "$SHELL_RC" ]; then
    echo "📝 Adding Docker BuildX environment variables to $SHELL_RC"
    
    # Check if already added
    if ! grep -q "BUILDX_BAKE_ENTITLEMENTS_FS" "$SHELL_RC"; then
        cat >> "$SHELL_RC" << 'EOF'

# Docker BuildX Configuration
export BUILDX_BAKE_ENTITLEMENTS_FS=0
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
EOF
        echo "✅ Environment variables added to $SHELL_RC"
        echo "🔄 Run 'source $SHELL_RC' or restart your terminal"
    else
        echo "✅ Environment variables already configured"
    fi
fi

# Set for current session
export BUILDX_BAKE_ENTITLEMENTS_FS=0
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "🎉 Docker build environment configured!"
echo ""
echo "🚀 You can now run builds without privilege prompts:"
echo "   docker buildx bake"
echo "   ./build.sh"
