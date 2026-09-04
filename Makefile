# Thin wrapper over the npm scripts so `make <thing>` works without remembering
# the script names. Everything here shells out to package.json; CI calls npm
# directly, so the two can never drift apart.

NPM ?= npm

.DEFAULT_GOAL := help
.PHONY: help install icons manifest build dev package clean lint format test verify browser recon e2e shot release-check

help: ## Show this help
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install dev dependencies and the Playwright browser
	$(NPM) install
	npx playwright install chromium

icons: ## Regenerate the icon set (pure Node, byte-reproducible)
	$(NPM) run icons

manifest: ## Regenerate extension/manifest.json from scripts/manifest.mjs
	$(NPM) run manifest

build: ## Build dist/chrome
	$(NPM) run build

dev: ## Build and rebuild on change
	$(NPM) run dev

package: ## Build and zip into release/
	$(NPM) run package

clean: ## Remove dist/ and release/
	$(NPM) run clean

lint: ## ESLint
	$(NPM) run lint

format: ## Prettier, in place
	$(NPM) run format

test: ## Unit tests
	$(NPM) test

verify: ## What CI runs: format check, lint, tests, build
	$(NPM) run verify

browser: ## Launch Chromium with the extension loaded and a signed-in session
	$(NPM) run browser

recon: ## Launch a browser that logs every API call to recon/captures/
	$(NPM) run browser:recon

e2e: ## Drive the popup end to end against the live API
	$(NPM) run e2e

shot: ## Refresh docs/popup.png
	$(NPM) run shot

release-check: verify package ## Everything the release workflow does, locally
	@echo "release/ is ready"
