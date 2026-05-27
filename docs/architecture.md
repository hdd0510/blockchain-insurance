# InsurChain v3 — Architecture And Diagrams

## 1. Actor Model

- `Customer`: submit claim, upload evidence, file appeal
- `Hospital`: verify patient record manually
- `Insurer`: handle claim operations and appeal review
- `Admin`: governance, policy admin, registry, audit
- `Oracle Service`: technical bridge between chain and hospital service
- `Smart Contract`: final payout / reject authority

## 2. Use Case Diagram

```mermaid
flowchart LR
    Customer(("Customer"))
    Hospital(("Hospital"))
    Insurer(("Insurer"))
    Admin(("Admin"))
    Oracle(("Oracle Service"))
    SC(("Claims Smart Contract"))

    UC1["Submit Claim"]
    UC2["Upload Evidence to IPFS"]
    UC3["Track Claim Status"]
    UC4["File Appeal"]
    UC5["Review Claim"]
    UC6["Sign Multi-sig Approval"]
    UC7["Review Appeal"]
    UC8["View Verification Queue"]
    UC9["Manual Medical Verification"]
    UC10["Register Hospital"]
    UC11["View Audit Logs"]
    UC12["Request Verification"]
    UC13["Auto Payout / Reject"]

    Customer --- UC1
    Customer --- UC2
    Customer --- UC3
    Customer --- UC4

    Insurer --- UC5
    Insurer --- UC6
    Insurer --- UC7
    Insurer --- UC8

    Hospital --- UC8
    Hospital --- UC9

    Admin --- UC10
    Admin --- UC11

    Oracle --- UC12
    SC --- UC12
    SC --- UC13
```

## 3. Activity Diagram

```mermaid
flowchart TB
    subgraph C["Customer"]
      C1[Submit claim]
      C2[Upload evidence -> IPFS]
      C3[Wait for status]
    end

    subgraph I["Insurer"]
      I1[Review claim]
      I2[Collect multi-sig approvals]
    end

    subgraph O["Oracle Service"]
      O1[Listen VerificationRequested]
      O2[Call hospital-service record match]
      O3[Create pending_manual verification row]
    end

    subgraph H["Hospital"]
      H1[Open hospital portal]
      H2[Inspect matched medical record]
      H3[Choose verified / not_verified]
    end

    subgraph S["Smart Contract"]
      S1[Receive oracle fulfill]
      S2{Verified?}
      S3[Transfer payout]
      S4[Reject claim]
    end

    C1 --> C2 --> I1 --> I2 --> O1 --> O2 --> O3 --> H1 --> H2 --> H3 --> S1
    S1 --> S2
    S2 -- yes --> S3 --> C3
    S2 -- no --> S4 --> C3
```

## 4. Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant U as Customer
    participant FE as React Frontend
    participant BE as Insurance Backend
    participant SC as ClaimsProcessor
    participant OR as MockOracle
    participant OS as Oracle Service
    participant HS as Hospital Service :3002
    participant HP as Hospital Portal User

    U->>FE: Submit claim + patient_id
    FE->>SC: submitClaim(...)
    FE->>BE: POST /claims
    BE-->>FE: claim mirrored in MySQL

    FE->>BE: insurer signs claim
    BE->>SC: signApproval(...) x N/M
    SC->>OR: requestVerification(claimId, patientIdHash, hospital)
    OR-->>OS: VerificationRequested

    OS->>HS: POST /records/match
    HS-->>OS: matched record / no record
    OS->>BE: create hospital_verifications(status=pending_manual)

    HP->>FE: Open hospital portal
    FE->>BE: GET /hospital/verifications
    HP->>FE: Click Verified / Not verified
    FE->>BE: POST /hospital/verifications/:id/manual
    BE->>OR: fulfillVerification(requestId, verdict, note)
    OR->>SC: fulfillVerification(...)

    alt verified
      SC->>U: payout ETH
    else not verified
      SC-->>U: claim rejected
    end
```

## 5. Component Diagram

```mermaid
flowchart LR
    subgraph Browser
      FE["React App"]
      MM["MetaMask"]
    end

    subgraph InsuranceHost
      API["Insurance Backend"]
      ORC["Oracle Service"]
      DB[("MySQL")]
      IPFS["Mock IPFS Storage"]
    end

    subgraph HospitalHost
      HS["Hospital Service"]
    end

    subgraph Chain
      CP["ClaimsProcessor.sol"]
      MO["MockOracle.sol"]
      HR["HospitalRegistry.sol"]
      IP["InsurancePolicy.sol"]
    end

    FE --> API
    FE --> MM
    MM --> CP
    API --> DB
    API --> IPFS
    API --> CP
    ORC --> MO
    ORC --> HS
    HS --> DB
    MO --> CP
    CP --> MO
    CP --> HR
    API --> IP
```

## 6. Deployment Diagram

```mermaid
flowchart TB
    User["User Browser + MetaMask"]

    subgraph AppServer["Insurance App Server"]
      FE["Frontend :3000"]
      BE["Backend :3001"]
      OD["Oracle daemon in backend process"]
    end

    subgraph HospitalServer["External Hospital Server"]
      HS["hospital-service :3002"]
    end

    subgraph Data["Persistence"]
      MYSQL[("MySQL")]
      IPFS[("backend/ipfs")]
    end

    subgraph Blockchain["Hardhat / EVM"]
      SC["ClaimsProcessor"]
      OR["MockOracle"]
      REG["HospitalRegistry"]
      POL["InsurancePolicy"]
    end

    User --> FE
    FE --> BE
    FE --> SC
    BE --> MYSQL
    BE --> IPFS
    OD --> OR
    OD --> HS
    HS --> MYSQL
    SC --> OR
    SC --> REG
    BE --> POL
```

## 7. ERD

```mermaid
erDiagram
    USERS {
        int id PK
        string wallet_address
        string role
        string full_name
        string hospital_name
        string nonce
    }

    POLICIES {
        int id PK
        bigint chain_policy_id
        string customer_wallet
        string status
    }

    CLAIMS {
        int id PK
        bigint chain_claim_id
        int policy_id FK
        string claimant_wallet
        string patient_id_hash
        string hospital_wallet
        string status
        bigint oracle_request_id
    }

    CLAIM_FILES {
        int id PK
        int claim_id FK
        string ipfs_cid
        string content_hash
    }

    APPEALS {
        int id PK
        int claim_id FK
        string appellant_wallet
        string status
    }

    HOSPITAL_RECORDS {
        int id PK
        string hospital_wallet
        string patient_id_hash
        string patient_name
        string record_number
        bool claimable
        decimal coverage_amount_eth
    }

    HOSPITAL_VERIFICATIONS {
        int id PK
        int claim_id FK
        bigint oracle_request_id
        int source_record_id FK
        string hospital_wallet
        string result
        string status
        string reviewed_by_wallet
        string oracle_tx_hash
    }

    AUDIT_LOGS {
        int id PK
        string user_wallet
        string action
        string entity_type
        string entity_id
    }

    POLICIES ||--o{ CLAIMS : has
    CLAIMS ||--o{ CLAIM_FILES : has
    CLAIMS ||--o| APPEALS : has
    CLAIMS ||--o{ HOSPITAL_VERIFICATIONS : has
    HOSPITAL_RECORDS ||--o{ HOSPITAL_VERIFICATIONS : source
```

## 8. Key Design Notes

- `insurer` là actor nghiệp vụ thật, tách khỏi `admin`.
- `hospital` là actor xác minh thật, không còn random mock.
- Oracle không tự quyết đúng/sai; nó chỉ bridge dữ liệu và submit verdict đã
  được hospital user xác nhận.
- Contract vẫn là nguồn chân lý cuối cùng cho payout và final claim state.
