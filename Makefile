# Makefile - Wiboor Extension

NAME    := $(shell node -p "require('./package.json').name")
VERSION := $(shell node -p "require('./package.json').version")
VSIX    := $(NAME)-$(VERSION).vsix

.PHONY: dev vsix


vsix: ## Gera o pacote .vsix
	npm install
	npm run compile
	npx --yes @vscode/vsce package --no-dependencies -o $(VSIX)
	@echo "Gerado: $(VSIX)"
