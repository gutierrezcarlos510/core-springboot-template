.PHONY: help scaffold scaffold-module setup dev-up dev-down test compile clean format docker-build docker-push logs

help:
	@echo "Comandos disponibles en core-springboot-template:"
	@echo ""
	@echo "  make scaffold SERVICE=NOMBRE PACKAGE=com.infosystem.nombre OUT=../nombre-backend"
	@echo "    Generar nuevo backend completo"
	@echo ""
	@echo "  make scaffold-module SERVICE=NOMBRE MODULE=Entidad TABLE=entidades"
	@echo "    Generar módulo CRUD en backend existente (ejecutar dentro del backend)"
	@echo ""
	@echo "  make setup SERVICE=nombre"
	@echo "    Setup inicial: generar certs, .env, docker compose up"
	@echo ""
	@echo "  make dev-up   - Levantar Postgres + app locales (compose.dev.yml)"
	@echo "  make dev-down - Bajar compose.dev.yml"
	@echo "  make test     - Correr tests (dentro backend)"
	@echo "  make compile  - Compilar código (dentro backend)"
	@echo "  make clean    - Limpiar target/ (dentro backend)"
	@echo "  make format   - Autoformat Java (dentro backend)"
	@echo "  make docker-build   - Build imagen Docker (dentro backend)"
	@echo "  make docker-push    - Push imagen a registry (dentro backend)"
	@echo "  make logs     - Ver logs de compose.dev.yml"

scaffold:
	@if [ -z "$(SERVICE)" ] || [ -z "$(PACKAGE)" ] || [ -z "$(OUT)" ]; then \
		echo "Error: uso: make scaffold SERVICE=FARMACIA PACKAGE=com.infosystem.farmacia OUT=../farmacia-backend"; \
		exit 1; \
	fi
	node scripts/scaffold-new-backend.mjs --service $(SERVICE) --package $(PACKAGE) --out $(OUT)
	@echo "✨ Backend '$(SERVICE)' creado en $(OUT)"
	@echo "📌 Próximos pasos:"
	@echo "   cd $(OUT)"
	@echo "   make setup SERVICE=$(SERVICE)"

scaffold-module:
	@if [ -z "$(MODULE)" ] || [ -z "$(TABLE)" ]; then \
		echo "Error: uso: make scaffold-module MODULE=Entidad TABLE=entidades"; \
		exit 1; \
	fi
	node scripts/scaffold-module.mjs --name $(MODULE) --table $(TABLE)

setup:
	@if [ -z "$(SERVICE)" ]; then \
		echo "Error: uso: make setup SERVICE=nombre"; \
		exit 1; \
	fi
	@echo "⚙️  Setup de backend '$(SERVICE)'..."
	@bash scripts/local-setup.sh $(SERVICE)
	@echo "✅ Setup completado. Arrancando ambiente local..."
	docker compose -f compose.dev.yml up -d
	@echo "✅ Postgres + app levantados"
	@echo "📌 Health check: curl http://localhost:8080/actuator/health"

dev-up:
	docker compose -f compose.dev.yml up -d
	@docker compose -f compose.dev.yml ps

dev-down:
	docker compose -f compose.dev.yml down

test:
	mvn -q -B test

compile:
	mvn -q -B compile

clean:
	mvn -q clean

format:
	mvn -q spotless:apply 2>/dev/null || echo "Spotless no configurado, formateando con IDE defaults"

docker-build:
	docker build -t $$(grep artifactId pom.xml | head -1 | sed 's/.*<artifactId>//;s/<\/artifactId>.*//' | tr -d ' '):latest .

docker-push:
	@echo "Configurar REGISTRY y credenciales en .env antes de push"
	docker push $$(grep artifactId pom.xml | head -1 | sed 's/.*<artifactId>//;s/<\/artifactId>.*//' | tr -d ' '):latest

logs:
	docker compose -f compose.dev.yml logs -f
