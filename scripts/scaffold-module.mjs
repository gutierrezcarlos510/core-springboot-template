#!/usr/bin/env node
/**
 * Script de CLI para generar un nuevo módulo CRUD en arquitectura por capas
 * (Controller, Service, Repository, Model y Migración Flyway).
 * Al igual que en core-backend, los modelos y DTOs (Request/Response) residen en 'model'.
 *
 * Ejemplo de uso:
 *   node scripts/scaffold-module.mjs --name Producto --table productos
 *   node scripts/scaffold-module.mjs --name Categoria
 *   npm run scaffold:module -- --name OrdenCompra --table ordenes_compra
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const nombreModulo = getArg('name');
let nombreTabla = getArg('table');
let paqueteBase = getArg('package');
const rootDir = process.cwd();

if (!nombreModulo) {
  console.error('❌ Error: Debes especificar el nombre del módulo con --name <NombrePascalCase>');
  console.error('Ejemplo: node scripts/scaffold-module.mjs --name Producto [--table productos]');
  process.exit(1);
}

// Formateadores de nombres
const pascalCase = nombreModulo.charAt(0).toUpperCase() + nombreModulo.slice(1);
const camelCase = nombreModulo.charAt(0).toLowerCase() + nombreModulo.slice(1);
if (!nombreTabla) {
  nombreTabla = camelCase.replace(/([A-Z])/g, '_$1').toLowerCase() + 's';
}

// Auto-detectar paquete Java escaneando Application.java en src/main/java o pom.xml
if (!paqueteBase) {
  const mainJavaDir = join(rootDir, 'src/main/java');
  if (existsSync(mainJavaDir)) {
    function buscarApplication(dir) {
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = join(dir, item.name);
        if (item.isDirectory()) {
          const res = buscarApplication(full);
          if (res) return res;
        } else if (item.isFile() && item.name.endsWith('Application.java')) {
          const content = readFileSync(full, 'utf8');
          const match = content.match(/package\s+([\w.]+);/);
          if (match) return match[1];
        }
      }
      return null;
    }
    paqueteBase = buscarApplication(mainJavaDir);
  }
}

if (!paqueteBase) {
  const pomPath = join(rootDir, 'pom.xml');
  if (existsSync(pomPath)) {
    const pomContent = readFileSync(pomPath, 'utf8');
    const groupIdMatch = pomContent.match(/<groupId>([^<]+)<\/groupId>/);
    if (groupIdMatch) {
      paqueteBase = groupIdMatch[1];
    }
  }
}

if (!paqueteBase) {
  paqueteBase = 'com.example.app';
}

const paqueteDir = paqueteBase.replaceAll('.', '/');
const mainJavaPath = join(rootDir, 'src/main/java', paqueteDir);
const mainResourcesPath = join(rootDir, 'src/main/resources');

function escribirArchivo(pathAbs, contenido) {
  if (existsSync(pathAbs)) {
    console.log(`⚠️ Ya existe, omitido: ${pathAbs}`);
    return;
  }
  mkdirSync(dirname(pathAbs), { recursive: true });
  writeFileSync(pathAbs, contenido, 'utf8');
  console.log(`✅ Creado: ${pathAbs}`);
}

console.log(`\n🚀 Scaffolding módulo '${pascalCase}' en paquete '${paqueteBase}' (tabla: '${nombreTabla}')...\n`);

// 1. Request DTO (en paquete model)
const requestContent = `package ${paqueteBase}.model;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Datos para crear o actualizar un ${pascalCase}")
public record ${pascalCase}Request(
    @NotBlank(message = "El nombre es obligatorio")
    @Size(min = 2, max = 150, message = "El nombre debe tener entre 2 y 150 caracteres")
    @Schema(description = "Nombre del ${camelCase}", example = "${pascalCase} de prueba", requiredMode = Schema.RequiredMode.REQUIRED)
    String nombre,

    @Size(max = 255, message = "La descripción no puede exceder 255 caracteres")
    @Schema(description = "Descripción del ${camelCase}", example = "Descripción de ejemplo")
    String descripcion,

    @Schema(description = "Estado operativo (ACTIVO, INACTIVO)", example = "ACTIVO", defaultValue = "ACTIVO")
    String estado
) {}
`;
escribirArchivo(join(mainJavaPath, 'model', `${pascalCase}Request.java`), requestContent);

// 2. Response DTO (en paquete model)
const responseContent = `package ${paqueteBase}.model;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Respuesta con los datos de ${pascalCase}")
public record ${pascalCase}Response(
    @Schema(description = "Identificador único UUID")
    UUID id,

    @Schema(description = "Nombre del ${camelCase}")
    String nombre,

    @Schema(description = "Descripción detallada")
    String descripcion,

    @Schema(description = "Estado actual")
    String estado,

    @Schema(description = "Fecha de creación")
    Instant createdAt,

    @Schema(description = "Fecha de actualización")
    Instant updatedAt
) {}
`;
escribirArchivo(join(mainJavaPath, 'model', `${pascalCase}Response.java`), responseContent);

// 3. Domain Model
const modelContent = `package ${paqueteBase}.model;

import java.time.Instant;
import java.util.UUID;

public record ${pascalCase}(
    UUID id,
    String nombre,
    String descripcion,
    String estado,
    Instant createdAt,
    Instant updatedAt
) {}
`;
escribirArchivo(join(mainJavaPath, 'model', `${pascalCase}.java`), modelContent);

// 4. Repository
const repositoryContent = `package ${paqueteBase}.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import ${paqueteBase}.model.${pascalCase};

@Repository
public class ${pascalCase}Repository {

    private final JdbcClient jdbcClient;

    public ${pascalCase}Repository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    private ${pascalCase} mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new ${pascalCase}(
            UUID.fromString(rs.getString("id")),
            rs.getString("nombre"),
            rs.getString("descripcion"),
            rs.getString("estado"),
            rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant() : null,
            rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant() : null
        );
    }

    public List<${pascalCase}> findAll() {
        String sql = """
            SELECT id, nombre, descripcion, estado, created_at, updated_at
            FROM ${nombreTabla}
            ORDER BY created_at DESC
            """;
        return jdbcClient.sql(sql).query(this::mapRow).list();
    }

    public Optional<${pascalCase}> findById(UUID id) {
        String sql = """
            SELECT id, nombre, descripcion, estado, created_at, updated_at
            FROM ${nombreTabla}
            WHERE id = :id
            """;
        return jdbcClient.sql(sql).param("id", id).query(this::mapRow).optional();
    }

    public ${pascalCase} save(${pascalCase} entity) {
        String sql = """
            INSERT INTO ${nombreTabla} (id, nombre, descripcion, estado, created_at, updated_at)
            VALUES (:id, :nombre, :descripcion, :estado, :createdAt, :updatedAt)
            """;
        jdbcClient.sql(sql)
            .param("id", entity.id())
            .param("nombre", entity.nombre())
            .param("descripcion", entity.descripcion())
            .param("estado", entity.estado())
            .param("createdAt", java.sql.Timestamp.from(entity.createdAt()))
            .param("updatedAt", java.sql.Timestamp.from(entity.updatedAt()))
            .update();
        return entity;
    }

    public boolean update(${pascalCase} entity) {
        String sql = """
            UPDATE ${nombreTabla}
            SET nombre = :nombre,
                descripcion = :descripcion,
                estado = :estado,
                updated_at = :updatedAt
            WHERE id = :id
            """;
        return jdbcClient.sql(sql)
            .param("id", entity.id())
            .param("nombre", entity.nombre())
            .param("descripcion", entity.descripcion())
            .param("estado", entity.estado())
            .param("updatedAt", java.sql.Timestamp.from(entity.updatedAt()))
            .update() > 0;
    }

    public boolean deleteById(UUID id) {
        String sql = "DELETE FROM ${nombreTabla} WHERE id = :id";
        return jdbcClient.sql(sql).param("id", id).update() > 0;
    }
}
`;
escribirArchivo(join(mainJavaPath, 'repository', `${pascalCase}Repository.java`), repositoryContent);

// 5. Service
const serviceContent = `package ${paqueteBase}.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ${paqueteBase}.exception.ResourceNotFoundException;
import ${paqueteBase}.model.${pascalCase};
import ${paqueteBase}.model.${pascalCase}Request;
import ${paqueteBase}.model.${pascalCase}Response;
import ${paqueteBase}.repository.${pascalCase}Repository;

@Service
@Transactional(readOnly = true)
public class ${pascalCase}Service {

    private final ${pascalCase}Repository repository;

    public ${pascalCase}Service(${pascalCase}Repository repository) {
        this.repository = repository;
    }

    public List<${pascalCase}Response> listarTodos() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    public ${pascalCase}Response obtenerPorId(UUID id) {
        ${pascalCase} entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("${pascalCase} no encontrado con el ID: " + id));
        return toResponse(entity);
    }

    @Transactional
    public ${pascalCase}Response crear(${pascalCase}Request request) {
        Instant ahora = Instant.now();
        ${pascalCase} nuevo = new ${pascalCase}(
            UUID.randomUUID(),
            request.nombre(),
            request.descripcion(),
            request.estado() != null ? request.estado() : "ACTIVO",
            ahora,
            ahora
        );
        return toResponse(repository.save(nuevo));
    }

    @Transactional
    public ${pascalCase}Response actualizar(UUID id, ${pascalCase}Request request) {
        ${pascalCase} existente = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("${pascalCase} no encontrado con el ID: " + id));

        Instant ahora = Instant.now();
        ${pascalCase} actualizado = new ${pascalCase}(
            existente.id(),
            request.nombre(),
            request.descripcion(),
            request.estado(),
            existente.createdAt(),
            ahora
        );

        repository.update(actualizado);
        return toResponse(actualizado);
    }

    @Transactional
    public void eliminar(UUID id) {
        if (!repository.deleteById(id)) {
            throw new ResourceNotFoundException("${pascalCase} no encontrado con el ID: " + id);
        }
    }

    private ${pascalCase}Response toResponse(${pascalCase} entity) {
        return new ${pascalCase}Response(
            entity.id(),
            entity.nombre(),
            entity.descripcion(),
            entity.estado(),
            entity.createdAt(),
            entity.updatedAt()
        );
    }
}
`;
escribirArchivo(join(mainJavaPath, 'service', `${pascalCase}Service.java`), serviceContent);

// 6. Controller
const controllerContent = `package ${paqueteBase}.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ${paqueteBase}.model.ApiResponse;
import ${paqueteBase}.model.${pascalCase}Request;
import ${paqueteBase}.model.${pascalCase}Response;
import ${paqueteBase}.service.${pascalCase}Service;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/${nombreTabla}")
@Tag(name = "${pascalCase}", description = "Gestión de ${pascalCase}")
public class ${pascalCase}Controller {

    private final ${pascalCase}Service service;

    public ${pascalCase}Controller(${pascalCase}Service service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Listar ${nombreTabla}", description = "Obtiene todos los registros de ${pascalCase}.")
    public ResponseEntity<ApiResponse<List<${pascalCase}Response>>> listar() {
        return ResponseEntity.ok(ApiResponse.ok(service.listarTodos()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener ${pascalCase} por ID")
    public ResponseEntity<ApiResponse<${pascalCase}Response>> obtenerPorId(
        @Parameter(description = "UUID único", required = true) @PathVariable UUID id
    ) {
        return ResponseEntity.ok(ApiResponse.ok(service.obtenerPorId(id)));
    }

    @PostMapping
    @Operation(summary = "Crear nuevo ${pascalCase}")
    public ResponseEntity<ApiResponse<${pascalCase}Response>> crear(
        @Valid @RequestBody ${pascalCase}Request request
    ) {
        ${pascalCase}Response nuevo = service.crear(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(nuevo, "${pascalCase} creado exitosamente"));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar ${pascalCase}")
    public ResponseEntity<ApiResponse<${pascalCase}Response>> actualizar(
        @Parameter(description = "UUID único", required = true) @PathVariable UUID id,
        @Valid @RequestBody ${pascalCase}Request request
    ) {
        return ResponseEntity.ok(ApiResponse.ok(service.actualizar(id, request), "${pascalCase} actualizado exitosamente"));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar ${pascalCase}")
    public ResponseEntity<ApiResponse<Void>> eliminar(
        @Parameter(description = "UUID único", required = true) @PathVariable UUID id
    ) {
        service.eliminar(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "${pascalCase} eliminado exitosamente"));
    }
}
`;
escribirArchivo(join(mainJavaPath, 'controller', `${pascalCase}Controller.java`), controllerContent);

// 7. Migración Flyway SQL
const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
const sqlContent = `-- Migración Flyway: Creación de la tabla ${nombreTabla}
CREATE TABLE IF NOT EXISTS ${nombreTabla} (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      VARCHAR(150) NOT NULL,
    descripcion VARCHAR(255),
    estado      VARCHAR(20) DEFAULT 'ACTIVO' NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE ${nombreTabla} IS 'Tabla para almacenar los registros de ${pascalCase}.';
COMMENT ON COLUMN ${nombreTabla}.id IS 'Identificador único UUID de ${pascalCase}.';
COMMENT ON COLUMN ${nombreTabla}.nombre IS 'Nombre descriptivo de ${pascalCase}.';
COMMENT ON COLUMN ${nombreTabla}.descripcion IS 'Descripción detallada de ${pascalCase}.';
COMMENT ON COLUMN ${nombreTabla}.estado IS 'Estado operativo del registro (ACTIVO, INACTIVO).';
COMMENT ON COLUMN ${nombreTabla}.created_at IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN ${nombreTabla}.updated_at IS 'Fecha y hora de última actualización del registro.';
`;
escribirArchivo(join(mainResourcesPath, 'db/migration', `V${timestamp}__create_${nombreTabla}_table.sql`), sqlContent);

console.log(`\n✨ ¡Módulo '${pascalCase}' generado con éxito!`);
console.log(`   Procesá la migración Flyway y actualizá los endpoints ejecutando:`);
console.log(`   node scripts/export-endpoints.mjs --service <TU_SERVICIO>\n`);
