# Flora y Fauna de Tandil

Catálogo de especies y hábitats naturales de Tandil: alta, edición, borrado y
búsqueda con filtros.

- **Back:** NestJS + TypeScript + PostgreSQL (TypeORM) → carpeta `back/`
- **Front:** Angular (componentes standalone + signals) → carpeta `front/`
- **Base:** PostgreSQL 16 en Docker → servicio `db` del `docker-compose.yml`

Todo lo corre con **un solo comando** gracias a Docker Compose.

---

## Cómo lo corro

### Opción 1 — Con Docker (la forma recomendada)

Necesitás Docker y Docker Compose installed. Nada más: ni Node, ni PostgreSQL,
ni instalar dependencias.

```bash
docker compose up --build -d
```

Después:

| Qué | Dónde |
|-----|-------|
| La página | http://localhost:8080 |
| La API | http://localhost:3000/habitats |

Los tres servicios (base, back y front) arrancan solos. La primera vez, el
back crea las tablas y carga datos de ejemplo (4 hábitats y 9 especies), así
que la página no arranca vacía.

```bash
docker compose ps          # ver el estado (los healthy tardan unos segundos)
docker compose logs -f back # ver los logs del back
docker compose down        # parar
docker compose down -v     # parar y BORRAR la base (¡cuidado!)
```

> `down -v` borra el volumen de datos. Sin la `-v`, los datos sobreviven.

### Opción 2 — Sin Docker (para desarrollar)

Son **dos aplicaciones separadas**, cada una con su propio `package.json`.

**1. La base de datos:**

```bash
docker run -d --name tandil-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tandildb \
  -p 5434:5432 postgres:16-alpine
```

**2. El back** (en una terminal):

```bash
cd back
npm install
cp .env.example .env      # solo si querés cambiar los valores
npm run start:dev         # http://localhost:3000
```

**3. El front** (en otra terminal):

```bash
cd front
npm install
npm start                 # http://localhost:4200
```

> El `.env` del back tiene `DB_PORT=5434` porque en esta máquina ya hay otros
> PostgreSQL locales ocupando el 5432 y el 5433. Adentro de Docker la base
> escucha en el 5432 y el host se llama `db` (ver `docker-compose.yml`).

---

## Estructura

```
.
├── docker-compose.yml      # los 3 servicios, la red, el volumen y los healthchecks
│
├── back/                     # API (NestJS)
│   ├── Dockerfile            # build multi-stage: compila con Node, corre con Node
│   ├── .dockerignore
│   └── src/
│       ├── main.ts           # arranque, CORS y validación global
│       ├── app.module.ts     # módulo raíz: config + base + módulos
│       ├── habitats/         # módulo de hábitats
│       │   ├── habitat.entity.ts       # la tabla "habitats"
│       │   ├── dto.ts                  # qué se espera en cada request
│       │   ├── dto.spec.ts             # tests de las validaciones
│       │   ├── habitats.controller.ts  # rutas HTTP
│       │   ├── habitats.service.ts     # lógica + acceso a la base
│       │   └── habitats.module.ts
│       ├── especies/         # módulo de especies (misma estructura)
│       └── database/
│           └── seed.service.ts         # carga de datos de ejemplo
│
├── front/                    # SPA (Angular)
│   ├── Dockerfile            # build multi-stage: compila con Node, sirve con nginx
│   ├── nginx.conf            # config de nginx (SPA fallback + cache)
│   ├── .dockerignore
│   └── src/app/
│       ├── app.ts / app.html # componente raíz: carga los hábitats
│       ├── config/api.ts     # URL de la API
│       ├── models/modelos.ts # interfaces de TypeScript
│       ├── services/         # un service por recurso + manejo de errores
│       │   └── habitats.service.spec.ts   # test del service
│       └── components/
│           ├── habitats/     # componente de hábitats
│           ├── especies/     # componente de especies
│           └── toast.ts      # avisos al usuario
│
└── .github/workflows/
    ├── ci-back.yml           # tests del backend (dispara si cambia back/**)
    └── ci-front.yml          # tests del frontend (dispara si cambia front/**)
```

La carpeta `k8s/` con los manifiestos de Kubernetes se explica más abajo, en
[Kubernetes (Minikube)](#kubernetes-minikube).

---

## Endpoints

### Hábitats

| Método | Ruta | Qué hace |
|--------|------|----------|
| `GET` | `/habitats` | lista todos, con cuántas especies tiene cada uno |
| `GET` | `/habitats/1` | uno por id |
| `POST` | `/habitats` | crea uno |
| `PATCH` | `/habitats/1` | modifica uno |
| `DELETE` | `/habitats/1` | borra uno (solo si no tiene especies) |

### Especies

| Método | Ruta | Qué hace |
|--------|------|----------|
| `GET` | `/especies` | lista, con filtros y paginación |
| `GET` | `/especies/1` | una por id |
| `POST` | `/especies` | crea una |
| `PATCH` | `/especies/1` | modifica una |
| `DELETE` | `/especies/1` | borra una |

**Filtros de `GET /especies`** (opcionales, se pueden combinar):

```
?nombre=om        coincidencia parcial, no importa mayúsculas
?tipo=flora       "flora" o "fauna"
?habitatId=1      filtra por hábitat
?endemica=true    solo las endémicas
?page=1&limit=10  paginación (limit máximo 50)
```

### Ejemplos

```bash
# Listar hábitats
curl http://localhost:3000/habitats

# Crear un hábitat
curl -X POST http://localhost:3000/habitats \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Barranca del Perdriel"}'

# Crear una especie
curl -X POST http://localhost:3000/especies \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Araña de tela","tipo":"fauna","habitatId":1,"endemica":true}'

# Solo las faunas endémicas
curl 'http://localhost:3000/especies?tipo=fauna&endemica=true'
```

---

## Docker

### Las tres imágenes

| Servicio | Imagen | De dónde sale |
|----------|--------|---------------|
| `db` | `postgres:16-alpine` | oficial de Docker Hub, no la construimos nosotros |
| `back` | `mathius15/tandil-back:1.0` | la construimos con `back/Dockerfile` |
| `front` | `mathius15/tandil-front:1.0` | la construimos con `front/Dockerfile` |

Las dos nuestras están publicadas en Docker Hub:

```
docker pull mathius15/tandil-back:1.0
docker pull mathius15/tandil-front:1.0
```

> Además del tag `1.0` hay otros dos que se usan más adelante: `latest` (el que
> usan Render y Kubernetes) y `k8s` en el front, compilado apuntando al backend
> de Minikube. La URL de la API va dentro del bundle, así que cada entorno
> necesita su propia imagen del front.

### Build multi-stage

Los dos `Dockerfile` tienen **dos etapas**:

- **Etapa 1 (build):** instala todo y compila. Usa Node.
- **Etapa 2 (runtime):** es la imagen final. No tiene Node.

La etapa 2 del back solo recibe el `dist/` ya compilado y las dependencias de
producción (`npm ci --omit=dev`). La etapa 2 del front solo recibe los
archivos estáticos y los sirve con **nginx**.

El resultado: la imagen del back no tiene TypeScript, ni Jest, ni ESLint, ni
el código fuente; y la del front no tiene Node instalado.

### La URL de la API y el `build arg`

La URL de la API **se compila dentro del bundle** de Angular, así que no se
puede cambiar en runtime: hay que cambiarla al compilar.

El `Dockerfile` del front recibe un `ARG` y lo inyecta en el código antes de
compilar:

```dockerfile
ARG API_URL=http://back:3000
RUN sed -i "s|^export const API_URL = .*|export const API_URL = '${API_URL}';|" \
        src/app/config/api.ts \
 && npm run build
```

El `docker-compose.yml` se lo pasa:

```yaml
front:
  build:
    context: ./front
    args:
      API_URL: http://localhost:3000
```

> **Ojo con esto:** la app es una SPA, o sea que **las peticiones a la API las
> hace el navegador**, no el contenedor del front. El navegador corre en la
> máquina del usuario y no sabe resolver `back` (ese nombre solo existe dentro
> de la red de Docker). Por eso la URL tiene que ser `localhost`, no `back`.
>
> La variante "correcta" para producción es que **nginx haga de proxy inverso**
> (`location /api/ { proxy_pass http://back:3000/; }`) y el front pegarle a
> `/api`. Así queda un solo puerto y un solo origen, y no hace falta CORS.

### Levantar con las imágenes publicadas

El `docker-compose.yml` usa `build:`, o sea que compila el código localmente.
Para correr con las imágenes de Docker Hub, se cambia `build:` por `image:`:

```yaml
back:
  image: mathius15/tandil-back:1.0
front:
  image: mathius15/tandil-front:1.0
```

### Red, healthchecks y volumen

- **Red:** Compose arma una red privada donde cada servicio se resuelve por su
  nombre. Por eso el back habla con la base como `DB_HOST: db`.
- **`healthcheck`:** el back espera a que la base esté *lista* (no solo
  *arrancada*) antes de levantarse. Sin esto, el back muere al no encontrar la
  base. Por eso va `depends_on: db: condition: service_healthy`.
- **Volumen:** `datos-db` guarda la base fuera de los contenedores. Sin él,
  cada `docker compose down` te borra los datos.

---

## Kubernetes (Minikube)

La app también corre en un cluster de Kubernetes local con **Minikube**. Los
manifiestos están en `k8s/` y se aplican con `kubectl`, igual que en un cluster
real. Docker Compose y Kubernetes son dos formas alternativas de correr lo
mismo: no hace falta levantar las dos.

### Requisitos

`minikube` y `kubectl` **no vienen con Docker**: hay que instalarlos aparte.
Los binarios van a `~/.local/bin` para no necesitar `sudo`.

```bash
mkdir -p ~/.local/bin

curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
install minikube-linux-amd64 ~/.local/bin/minikube

curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
install kubectl ~/.local/bin/kubectl
```

Arrancar el cluster (usa Docker como driver, o sea que Minikube corre en un
contenedor):

```bash
minikube start --driver=docker
kubectl get nodes          # el nodo tiene que estar Ready
```

### Los objetos

| Archivo | Objeto | Para qué |
|---------|--------|----------|
| `00-namespace.yaml` | `Namespace` | agrupa todo bajo `tandil` |
| `01-postgres-secret.yaml` | `Secret` | usuario, password y nombre de la base |
| `02-postgres-pvc.yaml` | `PersistentVolumeClaim` | 1 Gi de disco para la base |
| `03-postgres-deployment.yaml` | `Deployment` | corre Postgres |
| `04-postgres-service.yaml` | `Service` (ClusterIP) | le da el nombre `postgres` al backend |
| `05-backend-deployment.yaml` | `Deployment` | corre NestJS |
| `06-backend-service.yaml` | `Service` (NodePort) | expone la API en el puerto 30000 |
| `07-frontend-deployment.yaml` | `Deployment` | corre nginx con Angular |
| `08-frontend-service.yaml` | `Service` (NodePort) | expone la página en el puerto 30080 |

Los nombres llevan número porque `kubectl apply -f k8s/` aplica **en orden
alfabético**. Sin prefijos, `backend-deployment.yaml` se aplicaría antes que el
Namespace y fallaría con `namespace "tandil" not found`.

### Deployment y no Pod

Un `Pod` es la unidad mínima: si se cae, nadie lo vuelve a crear. Un
`Deployment` administra un `ReplicaSet`, que a su vez crea y repone los Pods.
Además da *rolling updates* y rollback:

```
Deployment  ──crea──►  ReplicaSet  ──crea──►  Pods
```

Un Pod suelto se escribe en menos líneas, pero no se recupera solo, no escala y
no tiene historial de versiones. Por eso los tres servicios usan `Deployment`.

El `Service` es aparte: los Pods tienen IPs que cambian, el Service tiene un
nombre fijo y reparte el tráfico entre los Pods que tengan su mismo `label`.

### Los tres puertos

```
navegador ──► <IP-minikube>:30000 ──► Service:3000 ──► Pod:3000
                 nodePort              port          targetPort
```

- `targetPort`: el puerto donde escucha el contenedor.
- `port`: el puerto del Service, para uso interno del cluster.
- `nodePort`: el puerto abierto en el nodo, para entrar desde afuera
  (rango 30000-32767).

### Publicar las imágenes

Minikube con driver Docker **no comparte** el daemon de Docker del host, así que
las imágenes se suben a Docker Hub y el cluster las baja de ahí.

Primero hay que saber la IP del nodo, porque la URL de la API se compila dentro
del front:

```bash
minikube ip
```

> En esta máquina dio `192.168.49.2`. Es la IP del contenedor de Minikube dentro
> de la red de Docker, y en Linux se llega directo desde el navegador.

Backend (es la misma imagen que usa Render):

```bash
docker build -t mathius15/tandil-back:latest ./back
docker push mathius15/tandil-back:latest
```

Frontend, con un tag propio (`:k8s`) para no pisar la imagen que apunta a Render:

```bash
docker build -t mathius15/tandil-front:k8s \
  --build-arg API_URL=http://<IP-minikube>:30000 ./front
docker push mathius15/tandil-front:k8s
```

### Desplegar

```bash
kubectl apply -f k8s/
kubectl get pods -n tandil
kubectl get svc -n tandil
```

Se aplican todos los archivos del directorio. El backend reintenta la conexión a
la base solo, así que no importa si Postgres tarda unos segundos más.

Para mirar los logs:

```bash
kubectl logs -f deploy/backend -n tandil
kubectl logs -f deploy/postgres -n tandil
```

### Ver la app

```bash
curl http://<IP-minikube>:30000/habitats
minikube service frontend -n tandil --url
minikube service frontend -n tandil        # abre el navegador
```

| Qué | URL |
|-----|-----|
| API | `http://<IP-minikube>:30000/habitats` |
| Front | `http://<IP-minikube>:30080` |

### Detalles que están así a propósito

- **Backend con 1 réplica.** El seed carga datos solo si las tablas están
  vacías; con dos réplicas arrancando juntas podrían duplicarse filas.
- **Postgres con `strategy: Recreate`.** El volumen es `ReadWriteOnce`: no se
  puede montar en dos Pods al mismo tiempo.
- **`PGDATA` en un subdirectorio.** Si se monta el volumen directo en
  `/var/lib/postgresql/data`, Postgres se queja porque el directorio no está
  vacío.
- **La IP de Minikube queda compilada en el front.** Si se borra el cluster
  (`minikube delete`), la IP puede cambiar y hay que reconstruir la imagen
  `:k8s`.
- **Sin Ingress ni HPA.** Con NodePort alcanza para la práctica; un Ingress
  necesitaría un controlador extra.

---

## Tests

Hay tests en **back y front**. Son pocos a propósito: verifican comportamiento
real, no que el código exista.

### Backend — `back/src/habitats/dto.spec.ts`

Verifica las validaciones del DTO de hábitats usando la misma función
`validate()` que usa el `ValidationPipe` en producción:

- acepta un nombre válido
- rechaza un nombre de menos de 3 letras, y comprueba el mensaje exacto
- rechaza un nombre vacío

```bash
cd back && npm test
```

### Frontend — `front/src/app/services/habitats.service.spec.ts`

Verifica que el service pegue a la URL correcta y con el método correcto,
usando `HttpTestingController` (que intercepta las peticiones, así que el
test no necesita la API andando):

```bash
cd front && npm test -- --watch=false --browsers=ChromeHeadless
```

`--watch=false` y `--browsers=ChromeHeadless` son los flags que usa el CI:
sin ventana y sin quedarse esperando.

### Cómo se comprueba que los tests sirven

Rompiendo el código a propósito. Por ejemplo, cambiar `@MinLength(3)` por
`@MinLength(1)` en `back/src/habitats/dto.ts` hace fallar el test; se
restaura y vuelve a pasar. Lo mismo con la URL del service en el front: si
apunta a `/habitatsXX` en vez de `/habitats`, el test falla diciendo exactamente
qué esperaba y qué recibió.

---

## Integración continua (GitHub Actions)

Hay dos workflows, en `.github/workflows/`:

| Workflow | Se dispara cuando | Corre |
|----------|-------------------|-------|
| `CI Back` | cambian archivos de `back/**` | `npm test` (Jest) |
| `CI Front` | cambian archivos de `front/**` | `npm test` (Karma + ChromeHeadless) |

Cada uno corre en su propia máquina virtual de GitHub y **en paralelo**. Si
algún test falla, el workflow se pone rojo y el log dice en qué paso.

> **Por qué dos archivos y no uno:** el filtro `paths` de GitHub decide si el
> workflow **entero** se dispara, no un job suelto. Con un solo archivo, tocar
> el front disparaba también los tests del back. Separándolos, cada workflow
> filtra por su carpeta.
>
> La alternativa es un solo workflow con un job que detecta los archivos
> modificados con `git diff` y jobs con `if:`. Esa variante tiene la ventaja de
> que el workflow siempre aparece en la interfaz (con jobs en *skipped*) y no
> se rompe con las *branch protections*.

---

## Scripts

**back/**

| Comando | Qué hace |
|---------|----------|
| `npm run start:dev` | arranca con recarga automática |
| `npm run build` | compila TypeScript a `dist/` |
| `npm run start:prod` | corre lo compilado |
| `npm run lint` | ESLint con autofix |
| `npm run format` | Prettier |
| `npm test` | corre los tests (Jest) |
| `npm run test:cov` | tests con reporte de cobertura |

**front/**

| Comando | Qué hace |
|---------|----------|
| `npm start` | servidor de desarrollo en el 4200 |
| `npm run build` | compila para producción en `dist/front` |
| `npm test` | tests con Karma + Jasmine |

---

## Cosas para saber

- **Validación:** cada DTO declara sus reglas con `class-validator` y un
  `ValidationPipe` global las aplica solo. Si algo falla, la API responde `400`
  con `{ "message": "..." }` (o un array de mensajes si falla más de una regla).
- **Errores:** `NotFoundException` → 404, `ConflictException` → 409.
  Borrar un hábitat con especies da 409 en vez de borrar todo.
- **Consultas siempre parametrizadas:** el `QueryBuilder` de TypeORM manda los
  valores aparte (`$1`, `$2`), nunca pegados en el texto. No hay inyección SQL.
- **Tablas:** las entidades (`*.entity.ts`) son la fuente de verdad. Con
  `DB_SYNC=true` TypeORM crea/actualiza las tablas solo, que está bien para
  desarrollo. **En producción eso se desactiva y lo que manda son las
  migraciones** (`typeorm migration:generate`), que todavía no están escritas.
- **CORS:** el front y el back corren en puertos distintos, así que la API
  tiene `enableCors()` para que el navegador los deje hablarse.
- **El `.env` no viaja en la imagen:** los `.dockerignore` lo excluyen, y las
  variables llegan por `environment:` del compose. Una contraseña publicada en
  Docker Hub queda pública para siempre.
- **Una limitación conocida:** TypeORM 1.x y `@nestjs/typeorm` 12 son módulos
  ESM, y Jest compila a CommonJS, así que no se pueden testear los services
  que importan de `@nestjs/typeorm` sin reconfigurar Jest. Por eso el test del
  back trabaja sobre el DTO, que no depende de TypeORM.
