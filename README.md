# Disaster Relief & Resource Coordination System (DRRCS)

DRRCS is a full-stack, secure, role-based disaster response and relief coordination platform designed for local authorities, NGOs, volunteers, and affected individuals. The system facilitates immediate resource requests, shelter mapping, emergency dispatch, and real-time coordination during disaster events.

---

## 🚀 Core Features

### 1. Interactive GIS Operations Map
- **Visual Tracking**: Renders active disasters, emergency shelters, and requests on a live Leaflet map.
- **Distinct Color-Coded Pins**: Custom high-contrast SVG markers replace generic pins to quickly identify resources:
  - 🔵 **User Location**: Blue pin
  - 🔴 **Active Disasters**: Red pin
  - 🟢 **Relief Shelters**: Green pin
  - 🟡 **Emergency Requests**: Orange/Amber pin
- **Safe Route Planning**: Allows coordinators to query routes to shelters, checking if the proposed path intercepts active hazard areas.

### 2. Incident Reporting & Visual Uploads
- **Base64 Photo Uploads**: Citizens can select and preview photos of incident sites before uploading. Photos are converted to base64, processed, and stored securely on disk.
- **Persistent Storage**: Configured with persistent volumes in Docker to ensure uploaded banners and incident images survive container builds, restarts, and redeployments.
- **Secure Image Serving**: Configured with proper CORS and Cross-Origin-Resource-Policy (CORP) headers so the frontend can securely render static assets served from the backend.

### 3. Rebuilt Notification & Dispatch Center
- **Role-Based Group Broadcasts**: Admins and NGO Coordinators can dispatch messages to all **Volunteers** or all **Affected Individuals** simultaneously.
- **Direct User Messaging**: Allows coordinators to target a specific user directly from a dynamically populated, role-filtered recipient dropdown.
- **Dismissible Inbox**: Recipients see messages in a clean list with absolute timestamps. A **Mark as Seen** button lets volunteers and citizens permanently clear notifications from their view.
- **Sender UX**: Senders receive a transient "Message sent" overlay popup on success, and sent logs are omitted from their own notifications feed to keep their views uncluttered.

### 4. Floating AI Relief Assistant
- **Live Database Context**: Operates using real-time database state (active disasters, available resources, shelter occupancy, and volunteer availability).
- **Rule-Based Fallbacks**: Features robust fallbacks to answer query details if external LLM APIs are unreachable or return errors.

### 5. Reactive Analytics Dashboard
- **Dynamic Updates**: Metric cards (Open Requests, Active Disasters, Shelter Occupancy, Available Resources) and resource usage graphs refresh instantly in the background when items are created or status changes occur.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, TypeScript, Zod Validation, Helmet (CORS/CORP)
- **Database & ORM**: PostgreSQL, Prisma ORM
- **Realtime**: Socket.io
- **API Documentation**: Swagger
- **Containerization**: Docker & Docker Compose

---

## 🏁 Quick Start

### Prerequisites
Make sure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed on your machine.

### Run with Docker Compose
1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd your-repo-name
   ```
2. Copy the example environment variables:
   ```bash
   cp .env.example .env
   ```
3. Build and spin up the containers:
   ```bash
   docker compose up --build
   ```
This will automatically launch the database, apply Prisma migrations, seed sample coordination data, compile the Next.js frontend, and spin up the Express API server.

### Local Ports & Services
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **Swagger Documentation**: [http://localhost:4000/api-docs](http://localhost:4000/api-docs)
- **PostgreSQL Database**: `localhost:5432`

---

## 🔑 Default Seed Accounts
All default accounts use the password **`Password123!`**:

| Role | Username / Email | Target Usage |
| :--- | :--- | :--- |
| **Admin** | `admin@drrcs.local` | System configuration and audit logging |
| **Authority** | `authority@drrcs.local` | Disaster reporting, evacuations, and broadcasts |
| **NGO Coordinator** | `ngo@drrcs.local` | Resource management, shelter creation, and dispatch |
| **Volunteer** | `volunteer@drrcs.local` | Responding to assigned requests and marking alerts |
| **Affected Individual** | `citizen@drrcs.local` | Submitting emergency requests and viewing alerts |

---

## 📂 Project Structure

```text
├── backend/
│   ├── prisma/             # Schema definition & database seeds
│   ├── src/
│   │   ├── routes/         # Express endpoints (auth, core API)
│   │   ├── middleware/     # Role check, validation, rate limits
│   │   └── server.ts       # Express server & configuration
│   └── Dockerfile
├── frontend/
│   ├── app/                # Next.js App Router (dashboard pages, layouts)
│   ├── components/         # Custom UI elements & OperationsMap (Leaflet)
│   ├── public/             # Branding assets (favicon)
│   └── Dockerfile
├── docker-compose.yml      # Multi-container orchestration config
├── .env.example            # Environment variables template
└── README.md               # Showcasing documentation
```
