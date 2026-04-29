<h1 align="center">Argus</h1>

<p align="center">
  External Attack Surface Management Platform for SMEs
</p>

<p align="center">
  <img src="https://i.ibb.co/JW81kMJV/main-Page.png" alt="Argus Main Page" width="900">
</p>

Argus is a lightweight External Attack Surface Management platform designed for SMEs.  
It helps identify external security exposures and presents findings, evidence, risk levels and recommended actions in a simple dashboard.

## Installation

Download the project ZIP from GitHub, move it to your Linux machine and extract it:

```bash
unzip easm-platform-main.zip
cd easm-platform-main
```
## Create the .env file and paste this:
```bash
nano .env

POSTGRES_DB=argus_db
POSTGRES_USER=argus_user
POSTGRES_PASSWORD=argus_password
POSTGRES_PORT=5432

BACKEND_PORT=8000
FRONTEND_PORT=5173

DATABASE_URL=postgresql://argus_user:argus_password@argus-postgres:5432/argus_db
```
## Start the project and open in your browser:
```bash
http://localhost:5173
```
