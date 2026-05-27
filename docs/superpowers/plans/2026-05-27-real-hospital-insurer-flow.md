# Real Hospital And Insurer Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace random hospital verification with a real demo record workflow, add a true insurer role, and update docs/diagrams to match the new architecture.

**Architecture:** Keep the current chain contracts and oracle callback model, but move off-chain verification to a persisted manual workflow. Hospital verifies against DB-backed demo records, oracle fulfills only after a hospital decision exists, insurer becomes the operational claim-processing actor, and admin is reduced to system governance.

**Tech Stack:** Solidity, Hardhat, Node.js, Express, Sequelize, MySQL, React, ethers.

---

### Task 1: Role And Model Foundation

**Files:**
- Modify: `backend/src/models/user-model.js`
- Modify: `backend/src/middleware/role-middleware.js`
- Modify: `backend/src/context/AuthContext.jsx`
- Modify: `frontend/src/components/layout/ProtectedRoute.jsx`
- Modify: `frontend/src/components/layout/Navbar.jsx`

- [ ] Add `insurer` role and role helpers across backend/frontend.

### Task 2: Hospital Records And Verification Persistence

**Files:**
- Create: `backend/src/models/hospital-record-model.js`
- Modify: `backend/src/models/hospital-verification-model.js`
- Modify: `backend/src/models/index.js`
- Modify: `scripts/seed-demo-data.sql`

- [ ] Add DB-backed hospital records and richer hospital verification state.

### Task 3: Test First For Hospital Verification Logic

**Files:**
- Create: `backend/tests/hospital-controller.test.js`
- Create: `backend/tests/helpers/mock-http.js`

- [ ] Add failing tests for record lookup, pending-manual status, and role gating.

### Task 4: Implement Hospital And Oracle Workflow

**Files:**
- Modify: `backend/src/controllers/hospital-controller.js`
- Modify: `backend/src/services/oracle-service.js`
- Modify: `backend/src/routes/hospital-routes.js`
- Modify: `backend/src/controllers/claim-controller.js`

- [ ] Make oracle create pending requests and fulfill only after hospital review.

### Task 5: Add Insurer Operational Surface

**Files:**
- Create: `frontend/src/pages/insurer/InsurerClaimsPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/services/claim-service.js`
- Modify: `backend/src/controllers/appeal-controller.js`
- Modify: `backend/src/routes/claim-routes.js`

- [ ] Expose claims and claim actions to the insurer role.

### Task 6: Update Demo External Hospital Service Shape

**Files:**
- Create: `hospital-service/README.md`
- Create: `hospital-service/server.js`
- Create: `hospital-service/package.json`

- [ ] Add a lightweight separate hospital service facade on its own port.

### Task 7: Docs, Diagrams, And Detailed Report

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Create: `docs/system-report.md`

- [ ] Update all diagrams and write the detailed report.

### Task 8: Verification

**Files:**
- Test: `contracts/test/insurance-contracts.test.js`
- Test: `backend/tests/hospital-controller.test.js`

- [ ] Run targeted tests and record any residual limitations.
