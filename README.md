# ShareLoop

A portfolio-quality full-stack community platform for free item sharing, second-hand trading, and wanted-item requests. ShareLoop connects neighbors to promote local circular economy, reduce waste, and build sustainable communities.

---

## Architecture & Technology Stack

| Layer | Technology | Version | Description |
|---|---|---|---|
| **Backend** | Spring Boot | 3.5.16 | REST API built on Java 17, Spring Web, Data JPA, Actuator & Validation |
| **Frontend** | React + TypeScript + Vite | 19.x / Vite 8.x | Modern responsive client with custom design system and type safety |
| **Database** | PostgreSQL | 16-Alpine | Relational persistence with volume isolation and health checks |
| **Build & Tooling**| Maven Wrapper & npm | Wrapper 3.3.4 | Consistent cross-platform builds without global CLI dependencies |
| **DevOps** | Docker Compose | 5.x specification | Containerized local PostgreSQL service with localhost port binding |

---

## Repository Structure

```text
Shareloop/
├── backend/                # Spring Boot REST API application
│   ├── .mvn/wrapper/       # Maven Wrapper configuration & properties
│   ├── src/                # Java source and test suites
│   ├── mvnw / mvnw.cmd     # Cross-platform Maven Wrapper executables
│   └── pom.xml             # Backend dependencies & build setup
├── frontend/               # React + TypeScript + Vite web client
│   ├── src/                # UI components, styles, and assets
│   ├── package.json        # Frontend scripts and dependencies
│   └── vite.config.ts      # Vite bundler & backend API proxy configuration
├── docs/                   # Project documentation and architecture specs
│   └── README.md
├── docker-compose.yml      # Local development PostgreSQL service
├── .env.example            # Environment variable template for local dev
├── .gitignore              # Git ignore rules for Java, Node, IDEs, and environments
└── README.md               # Repository documentation
```

---

## Prerequisites

- **Java**: Temurin OpenJDK 17+ (Maven CLI not required; Maven Wrapper is included)
- **Node.js**: v20+ (Node v24 and npm v11 verified)
- **Docker & Docker Compose**: For running the local PostgreSQL container

---

## Local Development Setup

### 1. Configure Environment Variables
Copy the sample environment file to create your local `.env`:
```bash
cp .env.example .env
```

### 2. Start PostgreSQL Database
Start the containerized PostgreSQL service:
```bash
docker compose up -d
```
The database port is bound to `127.0.0.1:5432` with credentials defined in `.env.example`.

### 3. Run the Backend API
Navigate to the `backend/` directory and start the Spring Boot application using Maven Wrapper:

- **Windows**:
  ```powershell
  cd backend
  .\mvnw.cmd spring-boot:run
  ```
- **macOS / Linux**:
  ```bash
  cd backend
  ./mvnw spring-boot:run
  ```

API health status is available at:
- Service Health: `http://localhost:8080/api/health`
- Actuator Health: `http://localhost:8080/actuator/health`

### 4. Run the Frontend Client
In a separate terminal, navigate to the `frontend/` directory, install dependencies, and launch the dev server:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. API requests to `/api` are automatically proxied to `http://localhost:8080`.

---

## Verification & Testing

### Backend
Run unit tests and verification with Maven Wrapper:
```powershell
cd backend
.\mvnw.cmd clean test
```
To build the executable production JAR:
```powershell
cd backend
.\mvnw.cmd clean package
```

### Frontend
Run linter and production build:
```bash
cd frontend
npm run lint
npm run build
```

### Docker Compose
Validate compose configuration:
```bash
docker compose config
```
